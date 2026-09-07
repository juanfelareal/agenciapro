import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// ============================================
// AREAS CONFIGURATION
// ============================================

/**
 * GET /api/structured-briefs/areas
 * Returns the configured brief areas for this org
 * (stored in organizations.settings JSONB)
 */
router.get('/areas', async (req, res) => {
  try {
    const org = await db.prepare('SELECT settings FROM organizations WHERE id = ?').get(req.orgId);

    // Default areas if not configured
    const defaultAreas = [
      { key: 'email_marketing', name: 'Email Marketing', default_responsible_id: null },
      { key: 'web', name: 'Optimizaciones Web', default_responsible_id: null },
      { key: 'traffic', name: 'Tráfico / Pauta', default_responsible_id: null },
      { key: 'design', name: 'Diseño', default_responsible_id: null },
    ];

    let settings = {};
    if (org?.settings) {
      try {
        settings = typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings;
      } catch {
        settings = {};
      }
    }

    const areas = settings.brief_areas || defaultAreas;

    // Enrich with team member names
    const enrichedAreas = await Promise.all(areas.map(async (area) => {
      if (area.default_responsible_id) {
        const member = await db.prepare('SELECT id, name FROM team_members WHERE id = ? AND organization_id = ?')
          .get(area.default_responsible_id, req.orgId);
        return { ...area, default_responsible_name: member?.name || null };
      }
      return { ...area, default_responsible_name: null };
    }));

    res.json(enrichedAreas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/structured-briefs/areas
 * Update the configured brief areas for this org
 */
router.put('/areas', async (req, res) => {
  try {
    const { areas } = req.body;

    if (!areas || !Array.isArray(areas)) {
      return res.status(400).json({ error: 'areas array is required' });
    }

    // Validate each area has key and name
    for (const area of areas) {
      if (!area.key || !area.name) {
        return res.status(400).json({ error: 'Each area must have key and name' });
      }
    }

    // Get current settings
    const org = await db.prepare('SELECT settings FROM organizations WHERE id = ?').get(req.orgId);
    let settings = {};
    if (org?.settings) {
      try {
        settings = typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings;
      } catch {
        settings = {};
      }
    }

    // Update brief_areas
    settings.brief_areas = areas;

    await db.prepare('UPDATE organizations SET settings = ? WHERE id = ?')
      .run(JSON.stringify(settings), req.orgId);

    res.json(areas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STRUCTURED BRIEF CRUD
// ============================================

/**
 * GET /api/structured-briefs
 * List all structured briefs (brief_type = 'structured')
 */
router.get('/', async (req, res) => {
  try {
    const { client_id, month } = req.query;
    let query = `
      SELECT b.*,
        c.company as client_company,
        c.nickname as client_nickname,
        c.name as client_name,
        p.name as generated_project_name
      FROM briefs b
      LEFT JOIN clients c ON b.client_id = c.id
      LEFT JOIN projects p ON b.generated_project_id = p.id
      WHERE b.organization_id = ? AND b.brief_type = 'structured'
    `;
    const params = [req.orgId];

    if (client_id) {
      query += ' AND b.client_id = ?';
      params.push(client_id);
    }

    if (month) {
      query += ' AND b.month = ?';
      params.push(month);
    }

    query += ' ORDER BY b.updated_at DESC';
    const briefs = await db.prepare(query).all(...params);
    res.json(briefs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/structured-briefs/:id
 * Get a structured brief with its sections and tasks
 */
router.get('/:id', async (req, res) => {
  try {
    const brief = await db.prepare(`
      SELECT b.*,
        c.company as client_company,
        c.nickname as client_nickname,
        c.name as client_name,
        p.name as generated_project_name
      FROM briefs b
      LEFT JOIN clients c ON b.client_id = c.id
      LEFT JOIN projects p ON b.generated_project_id = p.id
      WHERE b.id = ? AND b.organization_id = ? AND b.brief_type = 'structured'
    `).get(req.params.id, req.orgId);

    if (!brief) {
      return res.status(404).json({ error: 'Brief estructurado no encontrado' });
    }

    // Get sections with responsible names
    const sections = await db.prepare(`
      SELECT bs.*, tm.name as responsible_name
      FROM brief_sections bs
      LEFT JOIN team_members tm ON bs.responsible_id = tm.id
      WHERE bs.brief_id = ?
      ORDER BY bs.order_index ASC
    `).all(req.params.id);

    // Get tasks for each section
    for (const section of sections) {
      const tasks = await db.prepare(`
        SELECT bst.*, t.status as generated_task_status
        FROM brief_section_tasks bst
        LEFT JOIN tasks t ON bst.generated_task_id = t.id
        WHERE bst.section_id = ?
        ORDER BY bst.order_index ASC
      `).all(section.id);
      section.tasks = tasks;
    }

    res.json({ ...brief, sections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/structured-briefs
 * Create a new structured brief with sections and tasks
 */
router.post('/', async (req, res) => {
  try {
    const { client_id, title, month, visible_to_client, sections } = req.body;

    if (!client_id || !title) {
      return res.status(400).json({ error: 'client_id y title son requeridos' });
    }

    // Create the brief
    const briefResult = await db.prepare(`
      INSERT INTO briefs (client_id, title, month, visible_to_client, brief_type, organization_id, created_by)
      VALUES (?, ?, ?, ?, 'structured', ?, ?)
    `).run(
      client_id,
      title,
      month || null,
      visible_to_client ? 1 : 0,
      req.orgId,
      req.teamMember?.id || null
    );

    const briefId = briefResult.lastInsertRowid;

    // Create sections and tasks
    if (sections && Array.isArray(sections)) {
      for (let sIndex = 0; sIndex < sections.length; sIndex++) {
        const section = sections[sIndex];

        const sectionResult = await db.prepare(`
          INSERT INTO brief_sections (brief_id, area_key, area_name, responsible_id, context_text, order_index, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          briefId,
          section.area_key,
          section.area_name,
          section.responsible_id || null,
          section.context_text || null,
          section.order_index !== undefined ? section.order_index : sIndex,
          req.orgId
        );

        const sectionId = sectionResult.lastInsertRowid;

        // Create tasks for this section
        if (section.tasks && Array.isArray(section.tasks)) {
          for (let tIndex = 0; tIndex < section.tasks.length; tIndex++) {
            const task = section.tasks[tIndex];
            await db.prepare(`
              INSERT INTO brief_section_tasks (section_id, title, description, due_date, priority, order_index, organization_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              sectionId,
              task.title,
              task.description || null,
              task.due_date || null,
              task.priority || 'medium',
              task.order_index !== undefined ? task.order_index : tIndex,
              req.orgId
            );
          }
        }
      }
    }

    // Return the created brief with sections
    const brief = await db.prepare('SELECT * FROM briefs WHERE id = ?').get(briefId);
    const createdSections = await db.prepare(`
      SELECT bs.*, tm.name as responsible_name
      FROM brief_sections bs
      LEFT JOIN team_members tm ON bs.responsible_id = tm.id
      WHERE bs.brief_id = ?
      ORDER BY bs.order_index ASC
    `).all(briefId);

    for (const section of createdSections) {
      section.tasks = await db.prepare(`
        SELECT * FROM brief_section_tasks WHERE section_id = ? ORDER BY order_index ASC
      `).all(section.id);
    }

    res.status(201).json({ ...brief, sections: createdSections });
  } catch (error) {
    console.error('Error creating structured brief:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/structured-briefs/:id
 * Update a structured brief (metadata only, not sections)
 */
router.put('/:id', async (req, res) => {
  try {
    const { title, month, visible_to_client, client_id } = req.body;

    const existing = await db.prepare(
      'SELECT * FROM briefs WHERE id = ? AND organization_id = ? AND brief_type = ?'
    ).get(req.params.id, req.orgId, 'structured');

    if (!existing) {
      return res.status(404).json({ error: 'Brief estructurado no encontrado' });
    }

    await db.prepare(`
      UPDATE briefs SET
        title = COALESCE(?, title),
        month = COALESCE(?, month),
        visible_to_client = COALESCE(?, visible_to_client),
        client_id = COALESCE(?, client_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(
      title !== undefined ? title : null,
      month !== undefined ? month : null,
      visible_to_client !== undefined ? (visible_to_client ? 1 : 0) : null,
      client_id !== undefined ? client_id : null,
      req.params.id,
      req.orgId
    );

    const brief = await db.prepare('SELECT * FROM briefs WHERE id = ?').get(req.params.id);
    res.json(brief);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/structured-briefs/:id
 * Delete a structured brief (cascades to sections and tasks)
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.prepare(
      'DELETE FROM briefs WHERE id = ? AND organization_id = ? AND brief_type = ?'
    ).run(req.params.id, req.orgId, 'structured');

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Brief estructurado no encontrado' });
    }

    res.json({ message: 'Brief eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SECTION CRUD
// ============================================

/**
 * POST /api/structured-briefs/:id/sections
 * Add a new section to a brief
 */
router.post('/:id/sections', async (req, res) => {
  try {
    const { area_key, area_name, responsible_id, context_text, tasks } = req.body;

    if (!area_key || !area_name) {
      return res.status(400).json({ error: 'area_key y area_name son requeridos' });
    }

    // Verify brief exists and belongs to org
    const brief = await db.prepare(
      'SELECT * FROM briefs WHERE id = ? AND organization_id = ? AND brief_type = ?'
    ).get(req.params.id, req.orgId, 'structured');

    if (!brief) {
      return res.status(404).json({ error: 'Brief no encontrado' });
    }

    // Get max order_index
    const maxOrder = await db.prepare(
      'SELECT MAX(order_index) as max FROM brief_sections WHERE brief_id = ?'
    ).get(req.params.id);
    const newOrderIndex = (maxOrder?.max || 0) + 1;

    const result = await db.prepare(`
      INSERT INTO brief_sections (brief_id, area_key, area_name, responsible_id, context_text, order_index, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      area_key,
      area_name,
      responsible_id || null,
      context_text || null,
      newOrderIndex,
      req.orgId
    );

    const sectionId = result.lastInsertRowid;

    // Create tasks if provided
    if (tasks && Array.isArray(tasks)) {
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        await db.prepare(`
          INSERT INTO brief_section_tasks (section_id, title, description, due_date, priority, order_index, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          sectionId,
          task.title,
          task.description || null,
          task.due_date || null,
          task.priority || 'medium',
          i,
          req.orgId
        );
      }
    }

    const section = await db.prepare(`
      SELECT bs.*, tm.name as responsible_name
      FROM brief_sections bs
      LEFT JOIN team_members tm ON bs.responsible_id = tm.id
      WHERE bs.id = ?
    `).get(sectionId);

    section.tasks = await db.prepare(
      'SELECT * FROM brief_section_tasks WHERE section_id = ? ORDER BY order_index ASC'
    ).all(sectionId);

    res.status(201).json(section);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/structured-briefs/:id/sections/:sectionId
 * Update a section
 */
router.put('/:id/sections/:sectionId', async (req, res) => {
  try {
    const { area_name, responsible_id, context_text, order_index } = req.body;

    // Verify brief and section exist
    const brief = await db.prepare(
      'SELECT * FROM briefs WHERE id = ? AND organization_id = ? AND brief_type = ?'
    ).get(req.params.id, req.orgId, 'structured');

    if (!brief) {
      return res.status(404).json({ error: 'Brief no encontrado' });
    }

    const section = await db.prepare(
      'SELECT * FROM brief_sections WHERE id = ? AND brief_id = ?'
    ).get(req.params.sectionId, req.params.id);

    if (!section) {
      return res.status(404).json({ error: 'Sección no encontrada' });
    }

    await db.prepare(`
      UPDATE brief_sections SET
        area_name = COALESCE(?, area_name),
        responsible_id = ?,
        context_text = COALESCE(?, context_text),
        order_index = COALESCE(?, order_index),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      area_name !== undefined ? area_name : null,
      responsible_id !== undefined ? (responsible_id || null) : section.responsible_id,
      context_text !== undefined ? context_text : null,
      order_index !== undefined ? order_index : null,
      req.params.sectionId
    );

    const updatedSection = await db.prepare(`
      SELECT bs.*, tm.name as responsible_name
      FROM brief_sections bs
      LEFT JOIN team_members tm ON bs.responsible_id = tm.id
      WHERE bs.id = ?
    `).get(req.params.sectionId);

    updatedSection.tasks = await db.prepare(
      'SELECT * FROM brief_section_tasks WHERE section_id = ? ORDER BY order_index ASC'
    ).all(req.params.sectionId);

    res.json(updatedSection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/structured-briefs/:id/sections/:sectionId
 * Delete a section (cascades to tasks)
 */
router.delete('/:id/sections/:sectionId', async (req, res) => {
  try {
    // Verify brief exists
    const brief = await db.prepare(
      'SELECT * FROM briefs WHERE id = ? AND organization_id = ? AND brief_type = ?'
    ).get(req.params.id, req.orgId, 'structured');

    if (!brief) {
      return res.status(404).json({ error: 'Brief no encontrado' });
    }

    const result = await db.prepare(
      'DELETE FROM brief_sections WHERE id = ? AND brief_id = ?'
    ).run(req.params.sectionId, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Sección no encontrada' });
    }

    res.json({ message: 'Sección eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SECTION TASKS CRUD
// ============================================

/**
 * POST /api/structured-briefs/:id/sections/:sectionId/tasks
 * Add a task to a section
 */
router.post('/:id/sections/:sectionId/tasks', async (req, res) => {
  try {
    const { title, description, due_date, priority } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title es requerido' });
    }

    // Verify brief and section exist
    const section = await db.prepare(`
      SELECT bs.* FROM brief_sections bs
      JOIN briefs b ON bs.brief_id = b.id
      WHERE bs.id = ? AND bs.brief_id = ? AND b.organization_id = ? AND b.brief_type = 'structured'
    `).get(req.params.sectionId, req.params.id, req.orgId);

    if (!section) {
      return res.status(404).json({ error: 'Sección no encontrada' });
    }

    // Get max order_index
    const maxOrder = await db.prepare(
      'SELECT MAX(order_index) as max FROM brief_section_tasks WHERE section_id = ?'
    ).get(req.params.sectionId);
    const newOrderIndex = (maxOrder?.max || 0) + 1;

    const result = await db.prepare(`
      INSERT INTO brief_section_tasks (section_id, title, description, due_date, priority, order_index, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.sectionId,
      title,
      description || null,
      due_date || null,
      priority || 'medium',
      newOrderIndex,
      req.orgId
    );

    const task = await db.prepare('SELECT * FROM brief_section_tasks WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/structured-briefs/:id/sections/:sectionId/tasks/:taskId
 * Update a task
 */
router.put('/:id/sections/:sectionId/tasks/:taskId', async (req, res) => {
  try {
    const { title, description, due_date, priority, order_index } = req.body;

    // Verify task exists with proper hierarchy
    const task = await db.prepare(`
      SELECT bst.* FROM brief_section_tasks bst
      JOIN brief_sections bs ON bst.section_id = bs.id
      JOIN briefs b ON bs.brief_id = b.id
      WHERE bst.id = ? AND bs.id = ? AND b.id = ? AND b.organization_id = ?
    `).get(req.params.taskId, req.params.sectionId, req.params.id, req.orgId);

    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    await db.prepare(`
      UPDATE brief_section_tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        due_date = COALESCE(?, due_date),
        priority = COALESCE(?, priority),
        order_index = COALESCE(?, order_index)
      WHERE id = ?
    `).run(
      title !== undefined ? title : null,
      description !== undefined ? description : null,
      due_date !== undefined ? due_date : null,
      priority !== undefined ? priority : null,
      order_index !== undefined ? order_index : null,
      req.params.taskId
    );

    const updatedTask = await db.prepare('SELECT * FROM brief_section_tasks WHERE id = ?')
      .get(req.params.taskId);

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/structured-briefs/:id/sections/:sectionId/tasks/:taskId
 * Delete a task
 */
router.delete('/:id/sections/:sectionId/tasks/:taskId', async (req, res) => {
  try {
    // Verify task exists with proper hierarchy
    const task = await db.prepare(`
      SELECT bst.* FROM brief_section_tasks bst
      JOIN brief_sections bs ON bst.section_id = bs.id
      JOIN briefs b ON bs.brief_id = b.id
      WHERE bst.id = ? AND bs.id = ? AND b.id = ? AND b.organization_id = ?
    `).get(req.params.taskId, req.params.sectionId, req.params.id, req.orgId);

    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    await db.prepare('DELETE FROM brief_section_tasks WHERE id = ?').run(req.params.taskId);

    res.json({ message: 'Tarea eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GENERATE PROJECT FROM BRIEF
// ============================================

/**
 * POST /api/structured-briefs/:id/generate-project
 * Generate a project with tasks from the structured brief
 */
router.post('/:id/generate-project', async (req, res) => {
  try {
    // Get the brief with sections and tasks
    const brief = await db.prepare(`
      SELECT b.*, c.company as client_company, c.nickname as client_nickname
      FROM briefs b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ? AND b.organization_id = ? AND b.brief_type = 'structured'
    `).get(req.params.id, req.orgId);

    if (!brief) {
      return res.status(404).json({ error: 'Brief estructurado no encontrado' });
    }

    if (brief.generated_project_id) {
      return res.status(400).json({
        error: 'Este brief ya tiene un proyecto generado',
        project_id: brief.generated_project_id
      });
    }

    // Get sections with tasks
    const sections = await db.prepare(`
      SELECT * FROM brief_sections WHERE brief_id = ? ORDER BY order_index ASC
    `).all(req.params.id);

    if (sections.length === 0) {
      return res.status(400).json({ error: 'El brief no tiene secciones' });
    }

    // Build project name
    const clientName = brief.client_nickname || brief.client_company || 'Cliente';
    const monthDisplay = brief.month
      ? new Date(brief.month + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const projectName = `Brief ${clientName} - ${monthDisplay.charAt(0).toUpperCase() + monthDisplay.slice(1)}`;

    // Create the project
    const projectResult = await db.prepare(`
      INSERT INTO projects (name, client_id, status, organization_id, created_by)
      VALUES (?, ?, 'active', ?, ?)
    `).run(
      projectName,
      brief.client_id,
      req.orgId,
      req.teamMember?.id || null
    );

    const projectId = projectResult.lastInsertRowid;
    let taskOrder = 0;
    const createdTaskIds = [];

    // Create tasks for each section
    for (const section of sections) {
      const sectionTasks = await db.prepare(`
        SELECT * FROM brief_section_tasks WHERE section_id = ? ORDER BY order_index ASC
      `).all(section.id);

      for (const briefTask of sectionTasks) {
        // Validate responsible belongs to org
        let assigneeId = null;
        if (section.responsible_id) {
          const member = await db.prepare(
            'SELECT id FROM team_members WHERE id = ? AND organization_id = ?'
          ).get(section.responsible_id, req.orgId);
          if (member) assigneeId = member.id;
        }

        // Create the real task
        const taskResult = await db.prepare(`
          INSERT INTO tasks (
            title, description, project_id, assigned_to, status, priority,
            due_date, created_by, order_index, organization_id
          )
          VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?)
        `).run(
          briefTask.title,
          briefTask.description || null,
          projectId,
          assigneeId,
          briefTask.priority || 'medium',
          briefTask.due_date || null,
          req.teamMember?.id || null,
          taskOrder++,
          req.orgId
        );

        const newTaskId = taskResult.lastInsertRowid;
        createdTaskIds.push(newTaskId);

        // Add to task_assignees junction table
        if (assigneeId) {
          await db.prepare(`
            INSERT INTO task_assignees (task_id, team_member_id, organization_id)
            VALUES (?, ?, ?)
            ON CONFLICT (task_id, team_member_id) DO NOTHING
          `).run(newTaskId, assigneeId, req.orgId);
        }

        // Link brief task to generated task
        await db.prepare(`
          UPDATE brief_section_tasks SET generated_task_id = ? WHERE id = ?
        `).run(newTaskId, briefTask.id);
      }
    }

    // Link brief to generated project
    await db.prepare(`
      UPDATE briefs SET generated_project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(projectId, req.params.id);

    res.status(201).json({
      success: true,
      message: `Proyecto creado con ${createdTaskIds.length} tareas`,
      project_id: projectId,
      project_name: projectName,
      created_task_ids: createdTaskIds,
      task_count: createdTaskIds.length,
    });
  } catch (error) {
    console.error('Error generating project from brief:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
