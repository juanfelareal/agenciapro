import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/documents');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const router = express.Router();

// GET /api/client-documents/:clientId - List documents for a client
router.get('/:clientId', async (req, res) => {
  try {
    const client = await db.get('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [req.params.clientId, req.orgId]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const docs = await db.all(`
      SELECT cd.*, tm.name as uploaded_by_name
      FROM client_documents cd
      LEFT JOIN team_members tm ON cd.uploaded_by = tm.id
      WHERE cd.client_id = ? AND cd.organization_id = ?
      ORDER BY cd.created_at DESC
    `, [req.params.clientId, req.orgId]);

    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/client-documents/:clientId - Upload document
router.post('/:clientId', upload.single('file'), async (req, res) => {
  try {
    const client = await db.get('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [req.params.clientId, req.orgId]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const { label, category } = req.body;

    const result = await db.run(`
      INSERT INTO client_documents (client_id, label, category, file_name, file_path, file_size, file_type, uploaded_by, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.params.clientId,
      label || req.file.originalname,
      category || 'General',
      req.file.originalname,
      `/uploads/documents/${req.file.filename}`,
      req.file.size,
      req.file.mimetype,
      req.teamMember?.id || null,
      req.orgId,
    ]);

    const doc = await db.get('SELECT * FROM client_documents WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/client-documents/:clientId/:docId - Update document metadata
router.put('/:clientId/:docId', async (req, res) => {
  try {
    const doc = await db.get('SELECT * FROM client_documents WHERE id = ? AND client_id = ? AND organization_id = ?', [req.params.docId, req.params.clientId, req.orgId]);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const { label, category } = req.body;
    const updatedLabel = label !== undefined ? label : doc.label;
    const updatedCategory = category !== undefined ? category : doc.category;

    await db.run(`
      UPDATE client_documents SET label = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [updatedLabel, updatedCategory, req.params.docId]);

    const updated = await db.get('SELECT * FROM client_documents WHERE id = ?', [req.params.docId]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/client-documents/:clientId/:docId - Delete document
router.delete('/:clientId/:docId', async (req, res) => {
  try {
    const doc = await db.get('SELECT * FROM client_documents WHERE id = ? AND client_id = ? AND organization_id = ?', [req.params.docId, req.params.clientId, req.orgId]);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    // Delete file from disk
    const fullPath = path.join(__dirname, '../..', doc.file_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    await db.run('DELETE FROM client_documents WHERE id = ?', [req.params.docId]);
    res.json({ message: 'Documento eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
