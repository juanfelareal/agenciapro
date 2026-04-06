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

// =========================================================================
// Assignment-based public endpoints (per-client unique links with draft support)
// =========================================================================

// GET /assignment/:token — Load form + draft data for a specific client assignment
router.get('/assignment/:token', async (req, res) => {
  try {
    const assignment = await db.prepare(`
      SELECT fa.id, fa.form_id, fa.client_id, fa.status, fa.due_date,
        f.title, f.description,
        c.nickname, c.company, c.name as client_name
      FROM form_assignments fa
      JOIN forms f ON fa.form_id = f.id
      JOIN clients c ON fa.client_id = c.id
      WHERE fa.share_token = ? AND f.status = 'published'
    `).get(req.params.token);

    if (!assignment) {
      return res.status(404).json({ error: 'Formulario no encontrado o enlace no válido' });
    }

    // Load sections + fields
    const sections = await db.prepare(`
      SELECT * FROM form_sections WHERE form_id = ? ORDER BY position
    `).all(assignment.form_id);

    for (const section of sections) {
      section.fields = await db.prepare(`
        SELECT * FROM form_fields WHERE section_id = ? ORDER BY position
      `).all(section.id);
    }

    // Load existing draft data if any
    const response = await db.prepare(`
      SELECT data FROM form_responses WHERE assignment_id = ?
    `).get(assignment.id);

    res.json({
      assignment: {
        id: assignment.id,
        status: assignment.status,
        due_date: assignment.due_date,
        client_name: assignment.nickname || assignment.company || assignment.client_name,
        company: assignment.company,
      },
      form: { id: assignment.form_id, title: assignment.title, description: assignment.description },
      sections,
      draftData: response?.data || {}
    });
  } catch (error) {
    console.error('Error loading assignment form:', error);
    res.status(500).json({ error: 'Error al cargar formulario' });
  }
});

// PUT /assignment/:token/save — Save draft (partial answers)
router.put('/assignment/:token/save', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const assignment = await db.prepare(`
      SELECT fa.id, fa.status
      FROM form_assignments fa
      JOIN forms f ON fa.form_id = f.id
      WHERE fa.share_token = ? AND f.status = 'published'
    `).get(req.params.token);

    if (!assignment) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    if (assignment.status === 'submitted') {
      return res.status(400).json({ error: 'Este formulario ya fue enviado y no puede modificarse' });
    }

    // Upsert response draft
    const existing = await db.prepare(
      'SELECT id FROM form_responses WHERE assignment_id = ?'
    ).get(assignment.id);

    if (existing) {
      await db.prepare(`
        UPDATE form_responses SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE assignment_id = ?
      `).run(JSON.stringify(data), assignment.id);
    } else {
      await db.prepare(`
        INSERT INTO form_responses (assignment_id, data) VALUES (?, ?)
      `).run(assignment.id, JSON.stringify(data));
    }

    // Update assignment status to draft
    if (assignment.status === 'pending') {
      await db.prepare(`
        UPDATE form_assignments SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(assignment.id);
    }

    res.json({ message: 'Borrador guardado' });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({ error: 'Error al guardar borrador' });
  }
});

// POST /assignment/:token/submit — Submit final response
router.post('/assignment/:token/submit', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const assignment = await db.prepare(`
      SELECT fa.id, fa.form_id, fa.status
      FROM form_assignments fa
      JOIN forms f ON fa.form_id = f.id
      WHERE fa.share_token = ? AND f.status = 'published'
    `).get(req.params.token);

    if (!assignment) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    if (assignment.status === 'submitted') {
      return res.status(400).json({ error: 'Este formulario ya fue enviado' });
    }

    // Validate required fields
    const sections = await db.prepare(
      'SELECT id FROM form_sections WHERE form_id = ?'
    ).all(assignment.form_id);

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

    // Upsert response with submitted_at
    const existing = await db.prepare(
      'SELECT id FROM form_responses WHERE assignment_id = ?'
    ).get(assignment.id);

    if (existing) {
      await db.prepare(`
        UPDATE form_responses SET data = ?, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE assignment_id = ?
      `).run(JSON.stringify(data), assignment.id);
    } else {
      await db.prepare(`
        INSERT INTO form_responses (assignment_id, data, submitted_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(assignment.id, JSON.stringify(data));
    }

    // Update assignment status
    await db.prepare(`
      UPDATE form_assignments SET status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(assignment.id);

    res.json({ message: 'Formulario enviado exitosamente' });
  } catch (error) {
    console.error('Error submitting assignment form:', error);
    res.status(500).json({ error: 'Error al enviar formulario' });
  }
});

export default router;
