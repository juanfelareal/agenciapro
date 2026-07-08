import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// GET / — List all document templates
router.get('/', async (req, res) => {
  try {
    const { category, is_active } = req.query;
    let query = `
      SELECT dt.*, tm.name as creator_name,
        (SELECT COUNT(*) FROM document_signatures ds WHERE ds.template_id = dt.id) as total_signatures,
        (SELECT COUNT(*) FROM document_signatures ds WHERE ds.template_id = dt.id AND ds.status = 'signed') as signed_count
      FROM document_templates dt
      LEFT JOIN team_members tm ON dt.created_by = tm.id
      WHERE dt.organization_id = ?
    `;
    const params = [req.orgId];

    if (category) {
      query += ' AND dt.category = ?';
      params.push(category);
    }
    if (is_active !== undefined) {
      query += ' AND dt.is_active = ?';
      params.push(is_active === 'true');
    }

    query += ' ORDER BY dt.created_at DESC';

    const templates = await db.prepare(query).all(...params);
    res.json(templates);
  } catch (error) {
    console.error('Error listing document templates:', error);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// GET /:id — Get single template
router.get('/:id', async (req, res) => {
  try {
    const template = await db.prepare(`
      SELECT dt.*, tm.name as creator_name
      FROM document_templates dt
      LEFT JOIN team_members tm ON dt.created_by = tm.id
      WHERE dt.id = ? AND dt.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

// POST / — Create template
router.post('/', async (req, res) => {
  try {
    const { name, description, category, content, variables, requires_signature } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Nombre y contenido son requeridos' });
    }

    const result = await db.prepare(`
      INSERT INTO document_templates (name, description, category, content, variables, requires_signature, organization_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      description || null,
      category || 'nda',
      content,
      JSON.stringify(variables || []),
      requires_signature !== false,
      req.orgId,
      req.teamMember.id
    );

    const template = await db.prepare('SELECT * FROM document_templates WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Error al crear plantilla' });
  }
});

// PUT /:id — Update template
router.put('/:id', async (req, res) => {
  try {
    const { name, description, category, content, variables, requires_signature, is_active } = req.body;

    const existing = await db.prepare(
      'SELECT id FROM document_templates WHERE id = ? AND organization_id = ?'
    ).get(req.params.id, req.orgId);

    if (!existing) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    await db.prepare(`
      UPDATE document_templates
      SET name = ?, description = ?, category = ?, content = ?, variables = ?,
          requires_signature = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      description || null,
      category || 'nda',
      content,
      JSON.stringify(variables || []),
      requires_signature !== false,
      is_active !== false,
      req.params.id
    );

    const template = await db.prepare('SELECT * FROM document_templates WHERE id = ?').get(req.params.id);
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Error al actualizar plantilla' });
  }
});

// DELETE /:id — Delete template
router.delete('/:id', async (req, res) => {
  try {
    // Check for existing signatures
    const signatures = await db.prepare(
      'SELECT COUNT(*) as count FROM document_signatures WHERE template_id = ?'
    ).get(req.params.id);

    if (signatures.count > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar una plantilla con firmas existentes. Desactívala en su lugar.'
      });
    }

    const result = await db.prepare(
      'DELETE FROM document_templates WHERE id = ? AND organization_id = ?'
    ).run(req.params.id, req.orgId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    res.json({ message: 'Plantilla eliminada' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
});

// POST /:id/assign/:clientId — Assign document to client for signature
router.post('/:id/assign/:clientId', async (req, res) => {
  try {
    const { expires_at } = req.body;
    const templateId = req.params.id;
    const clientId = req.params.clientId;

    // Verify template exists
    const template = await db.prepare(
      'SELECT * FROM document_templates WHERE id = ? AND organization_id = ? AND is_active = true'
    ).get(templateId, req.orgId);

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada o inactiva' });
    }

    // Verify client exists
    const client = await db.prepare(
      'SELECT id, name, email FROM clients WHERE id = ? AND organization_id = ?'
    ).get(clientId, req.orgId);

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Check if already has pending signature for this template
    const existing = await db.prepare(
      'SELECT id FROM document_signatures WHERE template_id = ? AND client_id = ? AND status = ?'
    ).get(templateId, clientId, 'pending');

    if (existing) {
      return res.status(400).json({ error: 'El cliente ya tiene este documento pendiente de firma' });
    }

    const result = await db.prepare(`
      INSERT INTO document_signatures (template_id, client_id, signer_name, signer_email, expires_at, organization_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      templateId,
      clientId,
      client.name || '',
      client.email || '',
      expires_at || null,
      req.orgId
    );

    const signature = await db.prepare(`
      SELECT ds.*, dt.name as template_name, c.company as client_company
      FROM document_signatures ds
      JOIN document_templates dt ON ds.template_id = dt.id
      JOIN clients c ON ds.client_id = c.id
      WHERE ds.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(signature);
  } catch (error) {
    console.error('Error assigning document:', error);
    res.status(500).json({ error: 'Error al asignar documento' });
  }
});

// GET /signatures — List all signatures
router.get('/signatures/all', async (req, res) => {
  try {
    const { status, client_id, template_id } = req.query;
    let query = `
      SELECT ds.*, dt.name as template_name, dt.category,
        c.company as client_company, c.nickname as client_nickname
      FROM document_signatures ds
      JOIN document_templates dt ON ds.template_id = dt.id
      JOIN clients c ON ds.client_id = c.id
      WHERE ds.organization_id = ?
    `;
    const params = [req.orgId];

    if (status) {
      query += ' AND ds.status = ?';
      params.push(status);
    }
    if (client_id) {
      query += ' AND ds.client_id = ?';
      params.push(client_id);
    }
    if (template_id) {
      query += ' AND ds.template_id = ?';
      params.push(template_id);
    }

    query += ' ORDER BY ds.created_at DESC';

    const signatures = await db.prepare(query).all(...params);
    res.json(signatures);
  } catch (error) {
    console.error('Error listing signatures:', error);
    res.status(500).json({ error: 'Error al obtener firmas' });
  }
});

// GET /signatures/client/:clientId — Signatures for a specific client
router.get('/signatures/client/:clientId', async (req, res) => {
  try {
    const signatures = await db.prepare(`
      SELECT ds.*, dt.name as template_name, dt.category
      FROM document_signatures ds
      JOIN document_templates dt ON ds.template_id = dt.id
      WHERE ds.client_id = ? AND ds.organization_id = ?
      ORDER BY ds.created_at DESC
    `).all(req.params.clientId, req.orgId);

    res.json(signatures);
  } catch (error) {
    console.error('Error getting client signatures:', error);
    res.status(500).json({ error: 'Error al obtener firmas del cliente' });
  }
});

// GET /signatures/:signatureId — Get signature details
router.get('/signatures/:signatureId', async (req, res) => {
  try {
    const signature = await db.prepare(`
      SELECT ds.*, dt.name as template_name, dt.content as template_content, dt.category,
        c.company as client_company, c.nickname as client_nickname, c.name as client_name
      FROM document_signatures ds
      JOIN document_templates dt ON ds.template_id = dt.id
      JOIN clients c ON ds.client_id = c.id
      WHERE ds.id = ? AND ds.organization_id = ?
    `).get(req.params.signatureId, req.orgId);

    if (!signature) {
      return res.status(404).json({ error: 'Firma no encontrada' });
    }

    res.json(signature);
  } catch (error) {
    console.error('Error getting signature:', error);
    res.status(500).json({ error: 'Error al obtener firma' });
  }
});

// PUT /signatures/:signatureId/revoke — Revoke a signature
router.put('/signatures/:signatureId/revoke', async (req, res) => {
  try {
    const result = await db.prepare(`
      UPDATE document_signatures SET status = 'revoked' WHERE id = ? AND organization_id = ?
    `).run(req.params.signatureId, req.orgId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Firma no encontrada' });
    }

    res.json({ message: 'Firma revocada' });
  } catch (error) {
    console.error('Error revoking signature:', error);
    res.status(500).json({ error: 'Error al revocar firma' });
  }
});

// DELETE /signatures/:signatureId — Delete pending signature
router.delete('/signatures/:signatureId', async (req, res) => {
  try {
    const signature = await db.prepare(
      'SELECT status FROM document_signatures WHERE id = ? AND organization_id = ?'
    ).get(req.params.signatureId, req.orgId);

    if (!signature) {
      return res.status(404).json({ error: 'Firma no encontrada' });
    }

    if (signature.status === 'signed') {
      return res.status(400).json({ error: 'No se puede eliminar un documento ya firmado' });
    }

    await db.prepare('DELETE FROM document_signatures WHERE id = ?').run(req.params.signatureId);
    res.json({ message: 'Solicitud de firma eliminada' });
  } catch (error) {
    console.error('Error deleting signature:', error);
    res.status(500).json({ error: 'Error al eliminar firma' });
  }
});

export default router;
