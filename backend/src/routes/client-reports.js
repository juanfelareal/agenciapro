import express from 'express';
import multer from 'multer';
import db from '../config/database.js';
import { uploadBuffer, deleteBlob } from '../utils/blobStorage.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = express.Router();

// GET /api/client-reports/:clientId
router.get('/:clientId', async (req, res) => {
  try {
    const client = await db.prepare(
      'SELECT id FROM clients WHERE id = ? AND organization_id = ?'
    ).get(req.params.clientId, req.orgId);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const reports = await db.prepare(`
      SELECT r.*, tm.name as uploaded_by_name
      FROM client_reports r
      LEFT JOIN team_members tm ON r.uploaded_by = tm.id
      WHERE r.client_id = ? AND r.organization_id = ?
      ORDER BY COALESCE(r.period_start, r.created_at::text) DESC, r.created_at DESC
    `).all(req.params.clientId, req.orgId);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/client-reports/:clientId
router.post('/:clientId', upload.single('file'), async (req, res) => {
  try {
    const client = await db.prepare(
      'SELECT id FROM clients WHERE id = ? AND organization_id = ?'
    ).get(req.params.clientId, req.orgId);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const blob = await uploadBuffer('client-reports', req.file);

    const { title, report_type, period_label, period_start, period_end } = req.body;
    const result = await db.prepare(`
      INSERT INTO client_reports (client_id, organization_id, title, report_type, period_label, period_start, period_end, file_name, file_path, file_size, file_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.clientId,
      req.orgId,
      title || req.file.originalname,
      report_type || 'monthly',
      period_label || null,
      period_start || null,
      period_end || null,
      req.file.originalname,
      blob.url,
      req.file.size,
      req.file.mimetype,
      req.teamMember?.id || null,
    );

    const created = await db.prepare('SELECT * FROM client_reports WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/client-reports/:clientId/:reportId
router.delete('/:clientId/:reportId', async (req, res) => {
  try {
    const report = await db.prepare(
      'SELECT * FROM client_reports WHERE id = ? AND client_id = ? AND organization_id = ?'
    ).get(req.params.reportId, req.params.clientId, req.orgId);
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

    await db.prepare('DELETE FROM client_reports WHERE id = ?').run(report.id);
    await deleteBlob(report.file_path);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
