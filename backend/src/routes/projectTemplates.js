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

// Get template by ID with tasks
router.get('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const template = await db.prepare('SELECT * FROM project_templates WHERE id = ? AND organization_id = ?').get(req.params.id, orgId);

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const tasks = await db.prepare(`
      SELECT * FROM project_template_tasks
      WHERE template_id = ?
      ORDER BY order_index ASC
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
    const { name, description, tasks } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    // Create template with organization_id
    const result = await db.prepare(`
      INSERT INTO project_templates (name, description, organization_id)
      VALUES (?, ?, ?)
    `).run(name, description || null, orgId);

    const templateId = result.lastInsertRowid;

    // Insert tasks if provided
    if (tasks && tasks.length > 0) {
      for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        await db.prepare(`
          INSERT INTO project_template_tasks (template_id, title, description, priority, estimated_hours, order_index)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          templateId,
          task.title,
          task.description || null,
          task.priority || 'medium',
          task.estimated_hours || 0,
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
    const { name, description } = req.body;

    const currentTemplate = await db.prepare('SELECT * FROM project_templates WHERE id = ? AND organization_id = ?').get(req.params.id, orgId);
    if (!currentTemplate) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const updatedName = name !== undefined ? name : currentTemplate.name;
    const updatedDescription = description !== undefined ? description : currentTemplate.description;

    await db.prepare(`
      UPDATE project_templates
      SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(updatedName, updatedDescription, req.params.id, orgId);

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
    const { title, description, priority, estimated_hours } = req.body;

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
      INSERT INTO project_template_tasks (template_id, title, description, priority, estimated_hours, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, title, description || null, priority || 'medium', estimated_hours || 0, newOrderIndex);

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
    const { title, description, priority, estimated_hours, order_index } = req.body;

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
    const updatedOrderIndex = order_index !== undefined ? order_index : currentTask.order_index;

    await db.prepare(`
      UPDATE project_template_tasks
      SET title = ?, description = ?, priority = ?, estimated_hours = ?, order_index = ?
      WHERE id = ?
    `).run(updatedTitle, updatedDescription, updatedPriority, updatedEstimatedHours, updatedOrderIndex, req.params.taskId);

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

export default router;
