import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';

const router = express.Router();

// Generate a readable share code (like ABC1-XY23)
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

// GET / — List all forms
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT f.*,
        tm.name as creator_name,
        (SELECT COUNT(*) FROM form_assignments fa WHERE fa.form_id = f.id) as assignment_count,
        (SELECT COUNT(*) FROM form_assignments fa WHERE fa.form_id = f.id AND fa.status = 'submitted') as submitted_count,
        (SELECT COUNT(*) FROM form_public_responses fpr WHERE fpr.form_id = f.id) as public_response_count
      FROM forms f
      LEFT JOIN team_members tm ON f.created_by = tm.id
      WHERE f.organization_id = ?
    `;
    const params = [req.orgId];

    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (f.title ILIKE ? OR f.description ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY f.updated_at DESC';

    const forms = await db.prepare(query).all(...params);
    res.json(forms);
  } catch (error) {
    console.error('Error listing forms:', error);
    res.status(500).json({ error: 'Error al obtener formularios' });
  }
});

// GET /client/:clientId — Forms assigned to a specific client
router.get('/client/:clientId', async (req, res) => {
  try {
    const assignments = await db.prepare(`
      SELECT fa.*, f.title as form_title, f.description as form_description,
        (SELECT COUNT(*) FROM form_sections fs
         JOIN form_fields ff ON ff.section_id = fs.id
         WHERE fs.form_id = f.id) as fields_count
      FROM form_assignments fa
      JOIN forms f ON fa.form_id = f.id
      WHERE fa.client_id = ? AND fa.organization_id = ?
      ORDER BY fa.created_at DESC
    `).all(req.params.clientId, req.orgId);
    res.json(assignments);
  } catch (error) {
    console.error('Error getting client forms:', error);
    res.status(500).json({ error: 'Error al obtener formularios del cliente' });
  }
});

// GET /assignments/:assignmentId/response — View submitted response
router.get('/assignments/:assignmentId/response', async (req, res) => {
  try {
    const assignment = await db.prepare(`
      SELECT fa.*, f.title as form_title, f.description as form_description,
        c.name as client_name, c.company
      FROM form_assignments fa
      JOIN forms f ON fa.form_id = f.id
      JOIN clients c ON fa.client_id = c.id
      WHERE fa.id = ? AND fa.organization_id = ?
    `).get(req.params.assignmentId, req.orgId);

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    // Get form structure
    const sections = await db.prepare(`
      SELECT fs.* FROM form_sections fs
      WHERE fs.form_id = ?
      ORDER BY fs.position
    `).all(assignment.form_id);

    for (const section of sections) {
      section.fields = await db.prepare(`
        SELECT * FROM form_fields WHERE section_id = ? ORDER BY position
      `).all(section.id);
    }

    // Get response
    const response = await db.prepare(`
      SELECT * FROM form_responses WHERE assignment_id = ?
    `).get(assignment.id);

    res.json({ assignment, sections, response });
  } catch (error) {
    console.error('Error getting response:', error);
    res.status(500).json({ error: 'Error al obtener respuesta' });
  }
});

// DELETE /assignments/:assignmentId — Remove assignment
router.delete('/assignments/:assignmentId', async (req, res) => {
  try {
    const result = await db.prepare(`
      DELETE FROM form_assignments WHERE id = ? AND organization_id = ?
    `).run(req.params.assignmentId, req.orgId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }
    res.json({ message: 'Asignación eliminada' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'Error al eliminar asignación' });
  }
});

// GET /:id — Get form with sections and fields
router.get('/:id', async (req, res) => {
  try {
    const form = await db.prepare(`
      SELECT f.*, tm.name as creator_name
      FROM forms f
      LEFT JOIN team_members tm ON f.created_by = tm.id
      WHERE f.id = ? AND f.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!form) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }

    const sections = await db.prepare(`
      SELECT * FROM form_sections WHERE form_id = ? ORDER BY position
    `).all(form.id);

    for (const section of sections) {
      section.fields = await db.prepare(`
        SELECT * FROM form_fields WHERE section_id = ? ORDER BY position
      `).all(section.id);
    }

    form.sections = sections;

    // Get assignment count for warning
    const assignmentCount = await db.prepare(`
      SELECT COUNT(*) as count FROM form_assignments WHERE form_id = ? AND status != 'submitted'
    `).get(form.id);
    form.active_assignments = assignmentCount?.count || 0;

    res.json(form);
  } catch (error) {
    console.error('Error getting form:', error);
    res.status(500).json({ error: 'Error al obtener formulario' });
  }
});

// POST / — Create form
router.post('/', async (req, res) => {
  try {
    const { title, description, status = 'draft', sections = [] } = req.body;

    const result = await db.prepare(`
      INSERT INTO forms (title, description, status, created_by, organization_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, description, status, req.teamMember.id, req.orgId);

    const formId = result.lastInsertRowid;

    // Insert sections and fields
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionResult = await db.prepare(`
        INSERT INTO form_sections (form_id, title, description, position)
        VALUES (?, ?, ?, ?)
      `).run(formId, section.title, section.description || null, i);

      const sectionId = sectionResult.lastInsertRowid;

      if (section.fields) {
        for (let j = 0; j < section.fields.length; j++) {
          const field = section.fields[j];
          await db.prepare(`
            INSERT INTO form_fields (section_id, label, field_type, help_text, options, is_required, position)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            sectionId, field.label, field.field_type,
            field.help_text || null,
            field.options ? JSON.stringify(field.options) : null,
            field.is_required ? 1 : 0, j
          );
        }
      }
    }

    const form = await db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
    res.status(201).json(form);
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({ error: 'Error al crear formulario' });
  }
});

// PUT /:id — Update form (replace-all sections/fields)
router.put('/:id', async (req, res) => {
  try {
    const { title, description, status, sections } = req.body;
    const formId = req.params.id;

    // Verify ownership
    const existing = await db.prepare(
      'SELECT id FROM forms WHERE id = ? AND organization_id = ?'
    ).get(formId, req.orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }

    await db.prepare(`
      UPDATE forms SET title = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, status, formId);

    // Replace all sections/fields if provided
    if (sections) {
      // Delete old sections (cascades to fields)
      await db.prepare('DELETE FROM form_sections WHERE form_id = ?').run(formId);

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const sectionResult = await db.prepare(`
          INSERT INTO form_sections (form_id, title, description, position)
          VALUES (?, ?, ?, ?)
        `).run(formId, section.title, section.description || null, i);

        const sectionId = sectionResult.lastInsertRowid;

        if (section.fields) {
          for (let j = 0; j < section.fields.length; j++) {
            const field = section.fields[j];
            await db.prepare(`
              INSERT INTO form_fields (section_id, label, field_type, help_text, options, is_required, position)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              sectionId, field.label, field.field_type,
              field.help_text || null,
              field.options ? JSON.stringify(field.options) : null,
              field.is_required ? 1 : 0, j
            );
          }
        }
      }
    }

    const form = await db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
    res.json(form);
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(500).json({ error: 'Error al actualizar formulario' });
  }
});

// DELETE /:id — Delete form
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.prepare(
      'DELETE FROM forms WHERE id = ? AND organization_id = ?'
    ).run(req.params.id, req.orgId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    res.json({ message: 'Formulario eliminado' });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ error: 'Error al eliminar formulario' });
  }
});

// POST /:id/duplicate — Duplicate form
router.post('/:id/duplicate', async (req, res) => {
  try {
    const original = await db.prepare(
      'SELECT * FROM forms WHERE id = ? AND organization_id = ?'
    ).get(req.params.id, req.orgId);

    if (!original) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }

    const result = await db.prepare(`
      INSERT INTO forms (title, description, status, created_by, organization_id)
      VALUES (?, ?, 'draft', ?, ?)
    `).run(`${original.title} (copia)`, original.description, req.teamMember.id, req.orgId);

    const newFormId = result.lastInsertRowid;

    // Copy sections and fields
    const sections = await db.prepare(
      'SELECT * FROM form_sections WHERE form_id = ? ORDER BY position'
    ).all(original.id);

    for (const section of sections) {
      const sectionResult = await db.prepare(`
        INSERT INTO form_sections (form_id, title, description, position)
        VALUES (?, ?, ?, ?)
      `).run(newFormId, section.title, section.description, section.position);

      const fields = await db.prepare(
        'SELECT * FROM form_fields WHERE section_id = ? ORDER BY position'
      ).all(section.id);

      for (const field of fields) {
        await db.prepare(`
          INSERT INTO form_fields (section_id, label, field_type, help_text, options, is_required, position)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          sectionResult.lastInsertRowid, field.label, field.field_type,
          field.help_text, field.options ? JSON.stringify(field.options) : null,
          field.is_required, field.position
        );
      }
    }

    const newForm = await db.prepare('SELECT * FROM forms WHERE id = ?').get(newFormId);
    res.status(201).json(newForm);
  } catch (error) {
    console.error('Error duplicating form:', error);
    res.status(500).json({ error: 'Error al duplicar formulario' });
  }
});

// POST /:id/assign — Assign form to client
router.post('/:id/assign', async (req, res) => {
  try {
    const { client_id, due_date } = req.body;
    const formId = req.params.id;

    // Verify form exists and is published
    const form = await db.prepare(
      'SELECT id, status FROM forms WHERE id = ? AND organization_id = ?'
    ).get(formId, req.orgId);
    if (!form) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }

    // Check for existing assignment
    const existing = await db.prepare(
      'SELECT id FROM form_assignments WHERE form_id = ? AND client_id = ?'
    ).get(formId, client_id);
    if (existing) {
      return res.status(400).json({ error: 'Este formulario ya está asignado a este cliente' });
    }

    const result = await db.prepare(`
      INSERT INTO form_assignments (form_id, client_id, due_date, assigned_by, organization_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(formId, client_id, due_date || null, req.teamMember.id, req.orgId);

    const assignment = await db.prepare(`
      SELECT fa.*, c.name as client_name, c.company
      FROM form_assignments fa
      JOIN clients c ON fa.client_id = c.id
      WHERE fa.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning form:', error);
    res.status(500).json({ error: 'Error al asignar formulario' });
  }
});

// GET /:id/assignments — List assignments for a form
router.get('/:id/assignments', async (req, res) => {
  try {
    const assignments = await db.prepare(`
      SELECT fa.*, c.name as client_name, c.company,
        fr.submitted_at,
        (SELECT COUNT(*) FROM form_responses fr2 WHERE fr2.assignment_id = fa.id) as has_response
      FROM form_assignments fa
      JOIN clients c ON fa.client_id = c.id
      LEFT JOIN form_responses fr ON fr.assignment_id = fa.id
      WHERE fa.form_id = ? AND fa.organization_id = ?
      ORDER BY fa.created_at DESC
    `).all(req.params.id, req.orgId);

    res.json(assignments);
  } catch (error) {
    console.error('Error listing assignments:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// POST /:id/share — Generate share token
router.post('/:id/share', async (req, res) => {
  try {
    const form = await db.prepare(
      'SELECT id, share_token FROM forms WHERE id = ? AND organization_id = ?'
    ).get(req.params.id, req.orgId);
    if (!form) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }

    // Already has a token
    if (form.share_token) {
      return res.json({ share_token: form.share_token });
    }

    // Generate unique token with retry
    let token = null;
    for (let i = 0; i < 10; i++) {
      const candidate = generateShareCode();
      const existing = await db.prepare('SELECT id FROM forms WHERE share_token = ?').get(candidate);
      if (!existing) {
        token = candidate;
        break;
      }
    }
    if (!token) {
      return res.status(500).json({ error: 'No se pudo generar un código único' });
    }

    await db.prepare('UPDATE forms SET share_token = ? WHERE id = ?').run(token, form.id);
    res.json({ share_token: token });
  } catch (error) {
    console.error('Error generating share token:', error);
    res.status(500).json({ error: 'Error al generar enlace' });
  }
});

// DELETE /:id/share — Revoke share token
router.delete('/:id/share', async (req, res) => {
  try {
    const result = await db.prepare(
      'UPDATE forms SET share_token = NULL WHERE id = ? AND organization_id = ?'
    ).run(req.params.id, req.orgId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }
    res.json({ message: 'Enlace público desactivado' });
  } catch (error) {
    console.error('Error revoking share token:', error);
    res.status(500).json({ error: 'Error al desactivar enlace' });
  }
});

// GET /:id/public-responses — List public responses for a form
router.get('/:id/public-responses', async (req, res) => {
  try {
    const form = await db.prepare(
      'SELECT id FROM forms WHERE id = ? AND organization_id = ?'
    ).get(req.params.id, req.orgId);
    if (!form) {
      return res.status(404).json({ error: 'Formulario no encontrado' });
    }

    const responses = await db.prepare(`
      SELECT id, respondent_name, submitted_at, created_at
      FROM form_public_responses
      WHERE form_id = ?
      ORDER BY submitted_at DESC
    `).all(form.id);

    res.json(responses);
  } catch (error) {
    console.error('Error listing public responses:', error);
    res.status(500).json({ error: 'Error al obtener respuestas' });
  }
});

// GET /public-responses/:responseId — View single public response
router.get('/public-responses/:responseId', async (req, res) => {
  try {
    const response = await db.prepare(`
      SELECT fpr.*, f.title as form_title, f.description as form_description
      FROM form_public_responses fpr
      JOIN forms f ON fpr.form_id = f.id
      WHERE fpr.id = ? AND fpr.organization_id = ?
    `).get(req.params.responseId, req.orgId);

    if (!response) {
      return res.status(404).json({ error: 'Respuesta no encontrada' });
    }

    // Get form structure
    const sections = await db.prepare(`
      SELECT * FROM form_sections WHERE form_id = ? ORDER BY position
    `).all(response.form_id);

    for (const section of sections) {
      section.fields = await db.prepare(`
        SELECT * FROM form_fields WHERE section_id = ? ORDER BY position
      `).all(section.id);
    }

    res.json({ response, sections });
  } catch (error) {
    console.error('Error getting public response:', error);
    res.status(500).json({ error: 'Error al obtener respuesta' });
  }
});

export default router;
