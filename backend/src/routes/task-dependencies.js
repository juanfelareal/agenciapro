import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all dependencies for a task
router.get('/task/:taskId', async (req, res) => {
  try {
    const dependencies = await db.prepare(`
      SELECT td.*, t.title as depends_on_task_title,
             t.status as depends_on_task_status,
             t.timeline_start, t.timeline_end
      FROM task_dependencies td
      JOIN tasks t ON td.depends_on_task_id = t.id
      WHERE td.task_id = ?
    `).all(req.params.taskId);

    res.json(dependencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks that depend on a specific task
router.get('/task/:taskId/dependents', async (req, res) => {
  try {
    const dependents = await db.prepare(`
      SELECT td.*, t.title as task_title,
             t.status as task_status,
             t.timeline_start, t.timeline_end
      FROM task_dependencies td
      JOIN tasks t ON td.task_id = t.id
      WHERE td.depends_on_task_id = ?
    `).all(req.params.taskId);

    res.json(dependents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new dependency
router.post('/', async (req, res) => {
  try {
    const { task_id, depends_on_task_id, dependency_type } = req.body;

    if (!task_id || !depends_on_task_id) {
      return res.status(400).json({ error: 'Task ID and depends_on_task_id are required' });
    }

    // Prevent circular dependencies
    if (task_id === depends_on_task_id) {
      return res.status(400).json({ error: 'Cannot create a dependency to itself' });
    }

    const result = await db.prepare(`
      INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
      VALUES (?, ?, ?)
    `).run(task_id, depends_on_task_id, dependency_type || 'FS');

    const dependency = await db.prepare(`
      SELECT td.*, t.title as depends_on_task_title
      FROM task_dependencies td
      JOIN tasks t ON td.depends_on_task_id = t.id
      WHERE td.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(dependency);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update dependency type
router.put('/:id', async (req, res) => {
  try {
    const { dependency_type } = req.body;

    await db.prepare(`
      UPDATE task_dependencies
      SET dependency_type = ?
      WHERE id = ?
    `).run(dependency_type, req.params.id);

    const dependency = await db.prepare(`
      SELECT td.*, t.title as depends_on_task_title
      FROM task_dependencies td
      JOIN tasks t ON td.depends_on_task_id = t.id
      WHERE td.id = ?
    `).get(req.params.id);

    res.json(dependency);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete dependency
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM task_dependencies WHERE id = ?').run(req.params.id);
    res.json({ message: 'Dependency deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dependency chain for Gantt view (project level)
router.get('/project/:projectId/chain', async (req, res) => {
  try {
    const dependencies = await db.prepare(`
      SELECT td.*,
             t1.title as task_title,
             t1.timeline_start as task_start,
             t1.timeline_end as task_end,
             t2.title as depends_on_title,
             t2.timeline_start as depends_on_start,
             t2.timeline_end as depends_on_end
      FROM task_dependencies td
      JOIN tasks t1 ON td.task_id = t1.id
      JOIN tasks t2 ON td.depends_on_task_id = t2.id
      WHERE t1.project_id = ?
    `).all(req.params.projectId);

    res.json(dependencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
