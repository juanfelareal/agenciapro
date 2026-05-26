import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all project templates
router.get('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const templates = await db.prepare(`
      SELECT pt.*,
        (SELECT COUNT(*) FROM project_template_tasks WHERE template_id = pt.id) as task_count
      FROM project_templates pt
      WHERE pt.organization_id = ?
      ORDER BY pt.name ASC
    `).all(orgId);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CATEGORY ROUTES (must be before /:id)
// ============================================

// Get all categories (from dedicated table + derived from templates)
router.get('/categories/all', async (req, res) => {
  try {
    const orgId = req.orgId;
    const standalone = await db.all(
      'SELECT name FROM project_template_categories WHERE organization_id = ?',
      [orgId]
    );
    const fromTemplates = await db.all(
      "SELECT DISTINCT category as name FROM project_templates WHERE category IS NOT NULL AND category != '' AND organization_id = ?",
      [orgId]
    );
    const allNames = [...new Set([
      ...standalone.map(c => c.name),
      ...fromTemplates.map(c => c.name),
    ])].sort();
    res.json(allNames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a standalone category
router.post('/categories', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    await db.run(
      'INSERT INTO project_template_categories (name, organization_id) VALUES (?, ?) ON CONFLICT (name, organization_id) DO NOTHING',
      [name.trim(), orgId]
    );
    res.status(201).json({ name: name.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a category (remove from standalone table + clear from all templates)
router.delete('/categories/:name', async (req, res) => {
  try {
    const orgId = req.orgId;
    const categoryName = decodeURIComponent(req.params.name);
    await db.run(
      'DELETE FROM project_template_categories WHERE name = ? AND organization_id = ?',
      [categoryName, orgId]
    );
    await db.run(
      'UPDATE project_templates SET category = NULL, updated_at = CURRENT_TIMESTAMP WHERE category = ? AND organization_id = ?',
      [categoryName, orgId]
    );
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get template by ID with tasks
router.get('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const template = await db.prepare('SELECT * FROM project_templates WHERE id = ? AND organization_id = ?').get(req.params.id, orgId);

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const tasks = await db.prepare(`
      SELECT ptt.*, tm.name as default_assignee_name
      FROM project_template_tasks ptt
      LEFT JOIN team_members tm ON ptt.default_assignee_id = tm.id
      WHERE ptt.template_id = ?
      ORDER BY ptt.order_index ASC
    `).all(req.params.id);

    res.json({ ...template, tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new template
router.post('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { name, description, category, subcategory, tasks } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    // Create template with organization_id
    const result = await db.prepare(`
      INSERT INTO project_templates (name, description, category, subcategory, organization_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description || null, category || null, subcategory || null, orgId);

    const templateId = result.lastInsertRowid;

    // Insert tasks if provided
    if (tasks && tasks.length > 0) {
      for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        await db.prepare(`
          INSERT INTO project_template_tasks (template_id, title, description, priority, estimated_hours, default_assignee_id, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          templateId,
          task.title,
          task.description || null,
          task.priority || 'medium',
          task.estimated_hours || 0,
          task.default_assignee_id || null,
          task.order_index !== undefined ? task.order_index : index
        );
      }
    }

    const template = await db.prepare('SELECT * FROM project_templates WHERE id = ?').get(templateId);
    const templateTasks = await db.prepare('SELECT * FROM project_template_tasks WHERE template_id = ? ORDER BY order_index ASC').all(templateId);

    res.status(201).json({ ...template, tasks: templateTasks });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update template
router.put('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { name, description, category, subcategory } = req.body;

    const currentTemplate = await db.prepare('SELECT * FROM project_templates WHERE id = ? AND organization_id = ?').get(req.params.id, orgId);
    if (!currentTemplate) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const updatedName = name !== undefined ? name : currentTemplate.name;
    const updatedDescription = description !== undefined ? description : currentTemplate.description;
    const updatedCategory = category !== undefined ? (category || null) : currentTemplate.category;
    const updatedSubcategory = subcategory !== undefined ? (subcategory || null) : currentTemplate.subcategory;

    await db.prepare(`
      UPDATE project_templates
      SET name = ?, description = ?, category = ?, subcategory = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(updatedName, updatedDescription, updatedCategory, updatedSubcategory, req.params.id, orgId);

    const template = await db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id);
    const tasks = await db.prepare('SELECT * FROM project_template_tasks WHERE template_id = ? ORDER BY order_index ASC').all(req.params.id);

    res.json({ ...template, tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const template = await db.prepare('SELECT * FROM project_templates WHERE id = ? AND organization_id = ?').get(req.params.id, orgId);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    await db.prepare('DELETE FROM project_templates WHERE id = ? AND organization_id = ?').run(req.params.id, orgId);
    res.json({ message: 'Plantilla eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEMPLATE TASKS ROUTES
// ============================================

// Add task to template
router.post('/:id/tasks', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { title, description, priority, estimated_hours, default_assignee_id } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'El titulo de la tarea es requerido' });
    }

    // Verify template belongs to org
    const template = await db.prepare('SELECT * FROM project_templates WHERE id = ? AND organization_id = ?').get(req.params.id, orgId);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Get max order_index for this template
    const maxOrder = await db.prepare('SELECT MAX(order_index) as max FROM project_template_tasks WHERE template_id = ?').get(req.params.id);
    const newOrderIndex = (maxOrder.max || 0) + 1;

    const result = await db.prepare(`
      INSERT INTO project_template_tasks (template_id, title, description, priority, estimated_hours, default_assignee_id, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, title, description || null, priority || 'medium', estimated_hours || 0, default_assignee_id || null, newOrderIndex);

    const task = await db.prepare('SELECT * FROM project_template_tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update template task
router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { title, description, priority, estimated_hours, default_assignee_id, order_index } = req.body;

    // Verify template belongs to org
    const template = await db.prepare('SELECT * FROM project_templates WHERE id = ? AND organization_id = ?').get(req.params.id, orgId);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const currentTask = await db.prepare('SELECT * FROM project_template_tasks WHERE id = ? AND template_id = ?').get(req.params.taskId, req.params.id);
    if (!currentTask) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    const updatedTitle = title !== undefined ? title : currentTask.title;
    const updatedDescription = description !== undefined ? description : currentTask.description;
    const updatedPriority = priority !== undefined ? priority : currentTask.priority;
    const updatedEstimatedHours = estimated_hours !== undefined ? estimated_hours : currentTask.estimated_hours;
    const updatedAssignee = default_assignee_id !== undefined ? (default_assignee_id || null) : currentTask.default_assignee_id;
    const updatedOrderIndex = order_index !== undefined ? order_index : currentTask.order_index;

    await db.prepare(`
      UPDATE project_template_tasks
      SET title = ?, description = ?, priority = ?, estimated_hours = ?, default_assignee_id = ?, order_index = ?
      WHERE id = ?
    `).run(updatedTitle, updatedDescription, updatedPriority, updatedEstimatedHours, updatedAssignee, updatedOrderIndex, req.params.taskId);

    const task = await db.prepare('SELECT * FROM project_template_tasks WHERE id = ?').get(req.params.taskId);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template task
router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const orgId = req.orgId;

    // Verify template belongs to org
    const template = await db.prepare('SELECT * FROM project_templates WHERE id = ? AND organization_id = ?').get(req.params.id, orgId);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const task = await db.prepare('SELECT * FROM project_template_tasks WHERE id = ? AND template_id = ?').get(req.params.taskId, req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    await db.prepare('DELETE FROM project_template_tasks WHERE id = ?').run(req.params.taskId);
    res.json({ message: 'Tarea eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder tasks
router.put('/:id/tasks/reorder', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds array es requerido' });
    }

    // Verify template belongs to org
    const template = await db.prepare('SELECT * FROM project_templates WHERE id = ? AND organization_id = ?').get(req.params.id, orgId);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const updateOrder = db.prepare('UPDATE project_template_tasks SET order_index = ? WHERE id = ? AND template_id = ?');

    for (let index = 0; index < taskIds.length; index++) {
      await updateOrder.run(index, taskIds[index], req.params.id);
    }

    const tasks = await db.prepare('SELECT * FROM project_template_tasks WHERE template_id = ? ORDER BY order_index ASC').all(req.params.id);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// APPLY TEMPLATE TO PROJECT
// ============================================

/**
 * POST /api/project-templates/:id/apply
 * Body: { project_id, assignee_overrides?: { [template_task_id]: team_member_id|null } }
 *
 * Crea tareas reales en el proyecto a partir de la plantilla. Las nuevas
 * tareas se agregan al final preservando el orden original. Multi-tenant:
 * tanto plantilla como proyecto deben pertenecer a la misma org.
 */
router.post('/:id/apply', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { project_id, assignee_overrides = {} } = req.body || {};

    if (!project_id) {
      return res.status(400).json({ error: 'project_id es requerido' });
    }

    // Verify template + project belong to this org
    const template = await db.get(
      'SELECT id, name FROM project_templates WHERE id = ? AND organization_id = ?',
      [req.params.id, orgId]
    );
    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

    const project = await db.get(
      'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
      [project_id, orgId]
    );
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const templateTasks = await db.all(
      `SELECT id, title, description, priority, estimated_hours, default_assignee_id, order_index
       FROM project_template_tasks
       WHERE template_id = ?
       ORDER BY order_index ASC`,
      [req.params.id]
    );

    if (templateTasks.length === 0) {
      return res.status(400).json({ error: 'La plantilla no tiene tareas' });
    }

    // Find the current max order_index in this project so we append at the end
    const maxOrder = await db.get(
      `SELECT COALESCE(MAX(order_index), -1) AS max FROM tasks WHERE project_id = ?`,
      [project_id]
    );
    let nextOrder = (Number(maxOrder?.max) || -1) + 1;

    const createdTaskIds = [];

    for (const t of templateTasks) {
      // Override > template default > null
      const explicitOverride = Object.prototype.hasOwnProperty.call(assignee_overrides, t.id);
      const assigneeId = explicitOverride
        ? (assignee_overrides[t.id] || null)
        : (t.default_assignee_id || null);

      // Guard: only assign someone in this org
      let primaryAssignee = null;
      if (assigneeId) {
        const member = await db.get(
          `SELECT id FROM team_members WHERE id = ? AND organization_id = ?`,
          [assigneeId, orgId]
        );
        if (member) primaryAssignee = member.id;
      }

      const insert = await db.run(
        `INSERT INTO tasks (
           title, description, project_id, assigned_to, status, priority,
           estimated_hours, created_by, order_index, organization_id
         )
         VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?)`,
        [
          t.title,
          t.description || null,
          project_id,
          primaryAssignee,
          t.priority || 'medium',
          t.estimated_hours || 0,
          req.teamMember?.id || null,
          nextOrder++,
          orgId,
        ]
      );

      const newTaskId = insert.lastInsertRowid;
      createdTaskIds.push(newTaskId);

      // Mirror primary assignee into task_assignees (junction table) for the
      // multi-assignee model used by the rest of the app.
      if (primaryAssignee) {
        await db.run(
          `INSERT INTO task_assignees (task_id, team_member_id, organization_id)
           VALUES (?, ?, ?)
           ON CONFLICT (task_id, team_member_id) DO NOTHING`,
          [newTaskId, primaryAssignee, orgId]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: `Se crearon ${createdTaskIds.length} tareas desde "${template.name}"`,
      template_id: template.id,
      project_id,
      created_task_ids: createdTaskIds,
      count: createdTaskIds.length,
    });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
