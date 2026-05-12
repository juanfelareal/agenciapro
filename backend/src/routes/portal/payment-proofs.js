import express from 'express';
import multer from 'multer';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';
import { uploadBuffer, deleteBlob } from '../../utils/blobStorage.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router = express.Router();

// GET /api/portal/payment-proofs — list all client invoices with their proofs
router.get('/', clientAuthMiddleware, requirePortalPermission('can_view_invoices'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const invoices = await db.all(`
      SELECT i.id, i.invoice_number, i.amount, i.invoice_type, i.status,
             i.issue_date, i.notes, i.siigo_status,
             p.name as project_name
      FROM invoices i
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.client_id = ?
      ORDER BY i.issue_date DESC
    `, [clientId]);

    const proofs = await db.all(`
      SELECT id, invoice_id, file_name, file_path, file_size, file_type, notes, created_at
      FROM invoice_payment_proofs
      WHERE client_id = ?
      ORDER BY created_at DESC
    `, [clientId]);

    const proofsByInvoice = {};
    proofs.forEach((p) => {
      if (!proofsByInvoice[p.invoice_id]) proofsByInvoice[p.invoice_id] = [];
      proofsByInvoice[p.invoice_id].push(p);
    });

    res.json({
      invoices: invoices.map((inv) => ({ ...inv, proofs: proofsByInvoice[inv.id] || [] })),
    });
  } catch (error) {
    console.error('Error listing payment proofs:', error);
    res.status(500).json({ error: 'Error al cargar soportes' });
  }
});

// POST /api/portal/payment-proofs/:invoiceId — upload a payment proof for an invoice
router.post(
  '/:invoiceId',
  clientAuthMiddleware,
  requirePortalPermission('can_view_invoices'),
  upload.single('file'),
  async (req, res) => {
    try {
      const clientId = req.client.id;
      const invoiceId = req.params.invoiceId;
      if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

      const invoice = await db.get(
        'SELECT id, organization_id FROM invoices WHERE id = ? AND client_id = ?',
        [invoiceId, clientId]
      );
      if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

      const blob = await uploadBuffer('payment-proofs', req.file);

      const result = await db.run(
        `INSERT INTO invoice_payment_proofs (invoice_id, client_id, organization_id, file_name, file_path, file_size, file_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoice.id,
          clientId,
          invoice.organization_id,
          req.file.originalname,
          blob.url,
          req.file.size,
          req.file.mimetype,
          req.body.notes || null,
        ]
      );

      const proof = await db.get('SELECT * FROM invoice_payment_proofs WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(proof);
    } catch (error) {
      console.error('Error uploading payment proof:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/portal/payment-proofs/:id — client removes one of their proofs
router.delete('/:id', clientAuthMiddleware, requirePortalPermission('can_view_invoices'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const proof = await db.get(
      'SELECT * FROM invoice_payment_proofs WHERE id = ? AND client_id = ?',
      [req.params.id, clientId]
    );
    if (!proof) return res.status(404).json({ error: 'Soporte no encontrado' });

    await db.run('DELETE FROM invoice_payment_proofs WHERE id = ?', [proof.id]);
    await deleteBlob(proof.file_path);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
