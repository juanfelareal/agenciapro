import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../../../uploads/payment-proofs');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

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
      if (!invoice) {
        // Cleanup uploaded file if invoice is invalid
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Factura no encontrada' });
      }

      const result = await db.run(
        `INSERT INTO invoice_payment_proofs (invoice_id, client_id, organization_id, file_name, file_path, file_size, file_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoice.id,
          clientId,
          invoice.organization_id,
          req.file.originalname,
          `/uploads/payment-proofs/${req.file.filename}`,
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

    // Best-effort file cleanup
    if (proof.file_path?.startsWith('/uploads/')) {
      const absolute = path.join(__dirname, '../../../', proof.file_path.replace(/^\//, ''));
      fs.unlink(absolute, () => {});
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
