import express from 'express';
import db from '../../config/database.js';

const router = express.Router();

// GET /pending — Documents pending signature for this client
router.get('/pending', async (req, res) => {
  try {
    const documents = await db.prepare(`
      SELECT ds.id, ds.template_id, ds.status, ds.expires_at, ds.created_at,
        dt.name as template_name, dt.description as template_description, dt.category
      FROM document_signatures ds
      JOIN document_templates dt ON ds.template_id = dt.id
      WHERE ds.client_id = ? AND ds.status = 'pending'
      ORDER BY ds.created_at ASC
    `).all(req.client.id);

    res.json(documents);
  } catch (error) {
    console.error('Error getting pending documents:', error);
    res.status(500).json({ error: 'Error al obtener documentos pendientes' });
  }
});

// GET /signed — Documents already signed by this client
router.get('/signed', async (req, res) => {
  try {
    const documents = await db.prepare(`
      SELECT ds.id, ds.template_id, ds.signer_name, ds.signed_at, ds.pdf_url,
        dt.name as template_name, dt.category
      FROM document_signatures ds
      JOIN document_templates dt ON ds.template_id = dt.id
      WHERE ds.client_id = ? AND ds.status = 'signed'
      ORDER BY ds.signed_at DESC
    `).all(req.client.id);

    res.json(documents);
  } catch (error) {
    console.error('Error getting signed documents:', error);
    res.status(500).json({ error: 'Error al obtener documentos firmados' });
  }
});

// GET /:signatureId — Get document details for signing
router.get('/:signatureId', async (req, res) => {
  try {
    const document = await db.prepare(`
      SELECT ds.*, dt.name as template_name, dt.description as template_description,
        dt.content as template_content, dt.category, dt.variables
      FROM document_signatures ds
      JOIN document_templates dt ON ds.template_id = dt.id
      WHERE ds.id = ? AND ds.client_id = ?
    `).get(req.params.signatureId, req.client.id);

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    // Replace variables in content
    let content = document.template_content;
    const variables = JSON.parse(document.variables || '[]');

    // Auto-replace common variables
    const replacements = {
      '{{CLIENT_NAME}}': req.client.name || req.client.company,
      '{{CLIENT_COMPANY}}': req.client.company,
      '{{DATE}}': new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
      '{{SIGNER_NAME}}': document.signer_name || ''
    };

    for (const [key, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(key, 'g'), value);
    }

    res.json({
      ...document,
      rendered_content: content
    });
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ error: 'Error al obtener documento' });
  }
});

// POST /:signatureId/sign — Sign a document
router.post('/:signatureId/sign', async (req, res) => {
  try {
    const { signer_name, signer_cedula, signature_data, accepted_terms } = req.body;

    if (!signer_name || !accepted_terms) {
      return res.status(400).json({ error: 'Nombre y aceptación de términos son requeridos' });
    }

    // Get the document
    const document = await db.prepare(`
      SELECT ds.*, dt.content as template_content, dt.variables
      FROM document_signatures ds
      JOIN document_templates dt ON ds.template_id = dt.id
      WHERE ds.id = ? AND ds.client_id = ? AND ds.status = 'pending'
    `).get(req.params.signatureId, req.client.id);

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado o ya firmado' });
    }

    // Check expiration
    if (document.expires_at && new Date(document.expires_at) < new Date()) {
      await db.prepare(`UPDATE document_signatures SET status = 'expired' WHERE id = ?`).run(document.id);
      return res.status(400).json({ error: 'Este documento ha expirado' });
    }

    // Generate signed content with all variables replaced
    let signedContent = document.template_content;
    const replacements = {
      '{{CLIENT_NAME}}': req.client.name || req.client.company,
      '{{CLIENT_COMPANY}}': req.client.company,
      '{{DATE}}': new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
      '{{SIGNER_NAME}}': signer_name,
      '{{SIGNER_CEDULA}}': signer_cedula || ''
    };

    for (const [key, value] of Object.entries(replacements)) {
      signedContent = signedContent.replace(new RegExp(key, 'g'), value);
    }

    // Get IP and user agent
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Update signature record
    await db.prepare(`
      UPDATE document_signatures
      SET signer_name = ?, signer_cedula = ?, signature_data = ?, signed_content = ?,
          signed_at = CURRENT_TIMESTAMP, ip_address = ?, user_agent = ?, status = 'signed'
      WHERE id = ?
    `).run(
      signer_name,
      signer_cedula || null,
      signature_data || `typed:${signer_name}`,
      signedContent,
      ipAddress,
      userAgent,
      document.id
    );

    const signed = await db.prepare(`
      SELECT ds.*, dt.name as template_name
      FROM document_signatures ds
      JOIN document_templates dt ON ds.template_id = dt.id
      WHERE ds.id = ?
    `).get(document.id);

    res.json({
      message: 'Documento firmado exitosamente',
      signature: signed
    });
  } catch (error) {
    console.error('Error signing document:', error);
    res.status(500).json({ error: 'Error al firmar documento' });
  }
});

// GET /check-required — Check if client has pending required documents
router.get('/check/required', async (req, res) => {
  try {
    const pendingCount = await db.prepare(`
      SELECT COUNT(*) as count FROM document_signatures
      WHERE client_id = ? AND status = 'pending'
    `).get(req.client.id);

    res.json({
      has_pending: pendingCount.count > 0,
      pending_count: pendingCount.count
    });
  } catch (error) {
    console.error('Error checking required documents:', error);
    res.status(500).json({ error: 'Error al verificar documentos' });
  }
});

export default router;
