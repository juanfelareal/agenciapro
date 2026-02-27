import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';

const router = express.Router();

// GET / — List forms assigned to the logged-in client
router.get('/',
  clientAuthMiddleware,
  requirePortalPermission('can_view_forms'),
  async (req, res) => {
    try {
      const assignments = await db.prepare(`
        SELECT fa.id as assignment_id, fa.status, fa.due_date, fa.created_at as assigned_at,
          f.title as form_title, f.description as form_description,
          fr.submitted_at,
          (SELECT COUNT(*) FROM form_sections fs
           JOIN form_fields ff ON ff.section_id = fs.id
           WHERE fs.form_id = f.id) as fields_count
        FROM form_assignments fa
        JOIN forms f ON fa.form_id = f.id
        LEFT JOIN form_responses fr ON fr.assignment_id = fa.id
        WHERE fa.client_id = ? AND f.status = 'published'
        ORDER BY fa.created_at DESC
      `).all(req.client.id);

      // Count answered fields for each assignment
      for (const a of assignments) {
        if (a.status !== 'pending') {
          const response = await db.prepare(
            'SELECT data FROM form_responses WHERE assignment_id = ?'
          ).get(a.assignment_id);
          const data = response?.data || {};
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          a.fields_answered = Object.keys(parsed).filter(k => parsed[k] !== null && parsed[k] !== '').length;
        } else {
          a.fields_answered = 0;
        }
      }

      res.json({ forms: assignments });
    } catch (error) {
      console.error('Portal forms list error:', error);
      res.status(500).json({ error: 'Error al obtener formularios' });
    }
  }
);

// GET /:assignmentId — Get full form structure + current response data
router.get('/:assignmentId',
  clientAuthMiddleware,
  requirePortalPermission('can_view_forms'),
  async (req, res) => {
    try {
      const assignment = await db.prepare(`
        SELECT fa.*, f.id as form_id, f.title as form_title, f.description as form_description
        FROM form_assignments fa
        JOIN forms f ON fa.form_id = f.id
        WHERE fa.id = ? AND fa.client_id = ?
      `).get(req.params.assignmentId, req.client.id);

      if (!assignment) {
        return res.status(404).json({ error: 'Formulario no encontrado' });
      }

      // Get form structure
      const sections = await db.prepare(`
        SELECT * FROM form_sections WHERE form_id = ? ORDER BY position
      `).all(assignment.form_id);

      for (const section of sections) {
        section.fields = await db.prepare(`
          SELECT * FROM form_fields WHERE section_id = ? ORDER BY position
        `).all(section.id);
      }

      // Get existing response data
      const response = await db.prepare(
        'SELECT * FROM form_responses WHERE assignment_id = ?'
      ).get(assignment.id);

      let responseData = {};
      if (response?.data) {
        responseData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      }

      res.json({ assignment, sections, responseData });
    } catch (error) {
      console.error('Portal form detail error:', error);
      res.status(500).json({ error: 'Error al obtener formulario' });
    }
  }
);

// PUT /:assignmentId — Save draft
router.put('/:assignmentId',
  clientAuthMiddleware,
  requirePortalPermission('can_view_forms'),
  async (req, res) => {
    try {
      const { data } = req.body;

      // Verify assignment belongs to client
      const assignment = await db.prepare(
        'SELECT id, status FROM form_assignments WHERE id = ? AND client_id = ?'
      ).get(req.params.assignmentId, req.client.id);

      if (!assignment) {
        return res.status(404).json({ error: 'Formulario no encontrado' });
      }
      if (assignment.status === 'submitted') {
        return res.status(400).json({ error: 'Este formulario ya fue enviado' });
      }

      // Upsert response
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
      await db.prepare(`
        UPDATE form_assignments SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(assignment.id);

      res.json({ message: 'Borrador guardado' });
    } catch (error) {
      console.error('Portal form save draft error:', error);
      res.status(500).json({ error: 'Error al guardar borrador' });
    }
  }
);

// POST /:assignmentId/submit — Submit final response
router.post('/:assignmentId/submit',
  clientAuthMiddleware,
  requirePortalPermission('can_view_forms'),
  async (req, res) => {
    try {
      const { data } = req.body;

      // Verify assignment belongs to client
      const assignment = await db.prepare(`
        SELECT fa.id, fa.status, fa.form_id, fa.assigned_by
        FROM form_assignments fa
        WHERE fa.id = ? AND fa.client_id = ?
      `).get(req.params.assignmentId, req.client.id);

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
        const requiredFields = await db.prepare(`
          SELECT id, label FROM form_fields
          WHERE section_id IN (${placeholders}) AND is_required = 1
        `).all(...sectionIds);

        const missing = requiredFields.filter(f => {
          const val = data[String(f.id)];
          return val === undefined || val === null || val === '';
        });

        if (missing.length > 0) {
          return res.status(400).json({
            error: 'Hay campos obligatorios sin completar',
            missing_fields: missing.map(f => f.label)
          });
        }
      }

      // Upsert response with submitted_at
      const existing = await db.prepare(
        'SELECT id FROM form_responses WHERE assignment_id = ?'
      ).get(assignment.id);

      if (existing) {
        await db.prepare(`
          UPDATE form_responses
          SET data = ?, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE assignment_id = ?
        `).run(JSON.stringify(data), assignment.id);
      } else {
        await db.prepare(`
          INSERT INTO form_responses (assignment_id, data, submitted_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(assignment.id, JSON.stringify(data));
      }

      // Update assignment status
      await db.prepare(`
        UPDATE form_assignments SET status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(assignment.id);

      // Create notification for the team member who assigned it
      if (assignment.assigned_by) {
        try {
          await db.prepare(`
            INSERT INTO notifications (team_member_id, type, title, message, link)
            VALUES (?, 'info', ?, ?, ?)
          `).run(
            assignment.assigned_by,
            'Formulario completado',
            `${req.client.name} completó el formulario`,
            `/app/formularios`
          );
        } catch (e) {
          // Non-critical
        }
      }

      res.json({ message: 'Formulario enviado exitosamente' });
    } catch (error) {
      console.error('Portal form submit error:', error);
      res.status(500).json({ error: 'Error al enviar formulario' });
    }
  }
);

export default router;
