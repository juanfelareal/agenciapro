import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// GET /public/:token — Get form structure for public filling
router.get('/public/:token', async (req, res) => {
  try {
    const form = await db.prepare(`
      SELECT f.id, f.title, f.description
      FROM forms f
      WHERE f.share_token = ? AND f.status = 'published'
    `).get(req.params.token);

    if (!form) {
      return res.status(404).json({ error: 'Formulario no encontrado o enlace no válido' });
    }

    const sections = await db.prepare(`
      SELECT * FROM form_sections WHERE form_id = ? ORDER BY position
    `).all(form.id);

    for (const section of sections) {
      section.fields = await db.prepare(`
        SELECT * FROM form_fields WHERE section_id = ? ORDER BY position
      `).all(section.id);
    }

    res.json({ form, sections });
  } catch (error) {
    console.error('Error getting public form:', error);
    res.status(500).json({ error: 'Error al obtener formulario' });
  }
});

// POST /public/:token/submit — Submit public response
router.post('/public/:token/submit', async (req, res) => {
  try {
    const { respondent_name, data } = req.body;

    if (!respondent_name || !respondent_name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Los datos del formulario son requeridos' });
    }

    const form = await db.prepare(`
      SELECT f.id, f.organization_id
      FROM forms f
      WHERE f.share_token = ? AND f.status = 'published'
    `).get(req.params.token);

    if (!form) {
      return res.status(404).json({ error: 'Formulario no encontrado o enlace no válido' });
    }

    // Validate required fields
    const sections = await db.prepare(`
      SELECT fs.id FROM form_sections fs WHERE fs.form_id = ?
    `).all(form.id);

    const sectionIds = sections.map(s => s.id);
    if (sectionIds.length > 0) {
      const placeholders = sectionIds.map(() => '?').join(',');
      const requiredFields = await db.all(
        `SELECT id, label FROM form_fields WHERE section_id IN (${placeholders}) AND is_required = 1`,
        sectionIds
      );

      const missingFields = requiredFields.filter(f => {
        const val = data[String(f.id)];
        return val === undefined || val === null || val === '';
      });

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: 'Completa los campos requeridos antes de enviar.',
          missing_fields: missingFields.map(f => f.id)
        });
      }
    }

    // Save response
    await db.prepare(`
      INSERT INTO form_public_responses (form_id, respondent_name, data, organization_id)
      VALUES (?, ?, ?, ?)
    `).run(form.id, respondent_name.trim(), JSON.stringify(data), form.organization_id);

    res.status(201).json({ message: 'Formulario enviado exitosamente' });
  } catch (error) {
    console.error('Error submitting public form:', error);
    res.status(500).json({ error: 'Error al enviar formulario' });
  }
});

export default router;
