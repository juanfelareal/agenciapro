import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all project templates
router.get('/', (req, res) => {
  try {
    const templates = db.prepare(`
      SELECT pt.*,
        (SELECT COUNT(*) FROM project_template_tasks WHERE template_id = pt.id) as task_count
      FROM project_templates pt
      ORDER BY pt.name ASC
    `).all();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get template by ID with tasks
router.get('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const tasks = db.prepare(`
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
router.post('/', (req, res) => {
  try {
    const { name, description, tasks } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const result = db.prepare(`
      INSERT INTO project_templates (name, description)
      VALUES (?, ?)
    `).run(name, description || null);

    const templateId = result.lastInsertRowid;

    // Insert tasks if provided
    if (tasks && tasks.length > 0) {
      const insertTask = db.prepare(`
        INSERT INTO project_template_tasks (template_id, title, description, priority, estimated_hours, order_index)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      tasks.forEach((task, index) => {
        insertTask.run(
          templateId,
          task.title,
          task.description || null,
          task.priority || 'medium',
          task.estimated_hours || 0,
          task.order_index !== undefined ? task.order_index : index
        );
      });
    }

    const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(templateId);
    const templateTasks = db.prepare('SELECT * FROM project_template_tasks WHERE template_id = ? ORDER BY order_index ASC').all(templateId);

    res.status(201).json({ ...template, tasks: templateTasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update template
router.put('/:id', (req, res) => {
  try {
    const { name, description } = req.body;

    const currentTemplate = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id);
    if (!currentTemplate) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const updatedName = name !== undefined ? name : currentTemplate.name;
    const updatedDescription = description !== undefined ? description : currentTemplate.description;

    db.prepare(`
      UPDATE project_templates
      SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedName, updatedDescription, req.params.id);

    const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id);
    const tasks = db.prepare('SELECT * FROM project_template_tasks WHERE template_id = ? ORDER BY order_index ASC').all(req.params.id);

    res.json({ ...template, tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template
router.delete('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    db.prepare('DELETE FROM project_templates WHERE id = ?').run(req.params.id);
    res.json({ message: 'Plantilla eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEMPLATE TASKS ROUTES
// ============================================

// Add task to template
router.post('/:id/tasks', (req, res) => {
  try {
    const { title, description, priority, estimated_hours } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'El título de la tarea es requerido' });
    }

    const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Get max order_index for this template
    const maxOrder = db.prepare('SELECT MAX(order_index) as max FROM project_template_tasks WHERE template_id = ?').get(req.params.id);
    const newOrderIndex = (maxOrder.max || 0) + 1;

    const result = db.prepare(`
      INSERT INTO project_template_tasks (template_id, title, description, priority, estimated_hours, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, title, description || null, priority || 'medium', estimated_hours || 0, newOrderIndex);

    const task = db.prepare('SELECT * FROM project_template_tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update template task
router.put('/:id/tasks/:taskId', (req, res) => {
  try {
    const { title, description, priority, estimated_hours, order_index } = req.body;

    const currentTask = db.prepare('SELECT * FROM project_template_tasks WHERE id = ? AND template_id = ?').get(req.params.taskId, req.params.id);
    if (!currentTask) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    const updatedTitle = title !== undefined ? title : currentTask.title;
    const updatedDescription = description !== undefined ? description : currentTask.description;
    const updatedPriority = priority !== undefined ? priority : currentTask.priority;
    const updatedEstimatedHours = estimated_hours !== undefined ? estimated_hours : currentTask.estimated_hours;
    const updatedOrderIndex = order_index !== undefined ? order_index : currentTask.order_index;

    db.prepare(`
      UPDATE project_template_tasks
      SET title = ?, description = ?, priority = ?, estimated_hours = ?, order_index = ?
      WHERE id = ?
    `).run(updatedTitle, updatedDescription, updatedPriority, updatedEstimatedHours, updatedOrderIndex, req.params.taskId);

    const task = db.prepare('SELECT * FROM project_template_tasks WHERE id = ?').get(req.params.taskId);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template task
router.delete('/:id/tasks/:taskId', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM project_template_tasks WHERE id = ? AND template_id = ?').get(req.params.taskId, req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    db.prepare('DELETE FROM project_template_tasks WHERE id = ?').run(req.params.taskId);
    res.json({ message: 'Tarea eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder tasks
router.put('/:id/tasks/reorder', (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds array es requerido' });
    }

    const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const updateOrder = db.prepare('UPDATE project_template_tasks SET order_index = ? WHERE id = ? AND template_id = ?');

    taskIds.forEach((taskId, index) => {
      updateOrder.run(index, taskId, req.params.id);
    });

    const tasks = db.prepare('SELECT * FROM project_template_tasks WHERE template_id = ? ORDER BY order_index ASC').all(req.params.id);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
