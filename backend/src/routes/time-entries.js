import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all time entries with filters
router.get('/', async (req, res) => {
  try {
    const { user_id, project_id, task_id, start_date, end_date, is_running } = req.query;
    let query = `
      SELECT te.*,
        t.title as task_title,
        p.name as project_name,
        tm.name as user_name
      FROM time_entries te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN team_members tm ON te.user_id = tm.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ' AND te.user_id = ?';
      params.push(user_id);
    }

    if (project_id) {
      query += ' AND te.project_id = ?';
      params.push(project_id);
    }

    if (task_id) {
      query += ' AND te.task_id = ?';
      params.push(task_id);
    }

    if (start_date) {
      query += ' AND DATE(te.start_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(te.start_time) <= ?';
      params.push(end_date);
    }

    if (is_running !== undefined) {
      query += ' AND te.is_running = ?';
      params.push(is_running === 'true' ? 1 : 0);
    }

    query += ' ORDER BY te.start_time DESC';
    const entries = await db.prepare(query).all(...params);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get running timers for all users
router.get('/running', async (req, res) => {
  try {
    const entries = await db.prepare(`
      SELECT te.*,
        t.title as task_title,
        p.name as project_name,
        tm.name as user_name
      FROM time_entries te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN team_members tm ON te.user_id = tm.id
      WHERE te.is_running = 1
      ORDER BY te.start_time DESC
    `).all();
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get timesheet data (weekly view)
router.get('/timesheet', async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    let query = `
      SELECT te.*,
        t.title as task_title,
        p.name as project_name,
        tm.name as user_name,
        DATE(te.start_time) as entry_date
      FROM time_entries te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN team_members tm ON te.user_id = tm.id
      WHERE DATE(te.start_time) BETWEEN ? AND ?
        AND te.is_running = 0
    `;
    const params = [start_date, end_date];

    if (user_id) {
      query += ' AND te.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY te.start_time ASC';
    const entries = await db.prepare(query).all(...params);

    // Group by project and date
    const grouped = {};
    let totalMinutes = 0;

    entries.forEach(entry => {
      const projectKey = entry.project_id || 'no_project';
      const projectName = entry.project_name || 'Sin proyecto';

      if (!grouped[projectKey]) {
        grouped[projectKey] = {
          project_id: entry.project_id,
          project_name: projectName,
          entries: [],
          total_minutes: 0,
          by_date: {}
        };
      }

      grouped[projectKey].entries.push(entry);
      grouped[projectKey].total_minutes += entry.duration_minutes || 0;
      totalMinutes += entry.duration_minutes || 0;

      // Group by date within project
      const date = entry.entry_date;
      if (!grouped[projectKey].by_date[date]) {
        grouped[projectKey].by_date[date] = 0;
      }
      grouped[projectKey].by_date[date] += entry.duration_minutes || 0;
    });

    res.json({
      projects: Object.values(grouped),
      total_minutes: totalMinutes,
      total_hours: Math.round(totalMinutes / 60 * 100) / 100
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get time reports
router.get('/reports', async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'project' } = req.query;

    let dateFilter = '';
    const params = [];

    if (start_date) {
      dateFilter += ' AND DATE(te.start_time) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND DATE(te.start_time) <= ?';
      params.push(end_date);
    }

    // Time by project
    const byProject = await db.prepare(`
      SELECT
        p.id as project_id,
        p.name as project_name,
        SUM(te.duration_minutes) as total_minutes,
        COUNT(te.id) as entry_count,
        SUM(CASE WHEN te.billable = 1 THEN te.duration_minutes ELSE 0 END) as billable_minutes
      FROM time_entries te
      LEFT JOIN projects p ON te.project_id = p.id
      WHERE te.is_running = 0 ${dateFilter}
      GROUP BY te.project_id
      ORDER BY total_minutes DESC
    `).all(...params);

    // Time by user
    const byUser = await db.prepare(`
      SELECT
        tm.id as user_id,
        tm.name as user_name,
        SUM(te.duration_minutes) as total_minutes,
        COUNT(te.id) as entry_count,
        SUM(CASE WHEN te.billable = 1 THEN te.duration_minutes ELSE 0 END) as billable_minutes
      FROM time_entries te
      LEFT JOIN team_members tm ON te.user_id = tm.id
      WHERE te.is_running = 0 ${dateFilter}
      GROUP BY te.user_id
      ORDER BY total_minutes DESC
    `).all(...params);

    // Time by day (for charts)
    const byDay = await db.prepare(`
      SELECT
        DATE(te.start_time) as date,
        SUM(te.duration_minutes) as total_minutes,
        SUM(CASE WHEN te.billable = 1 THEN te.duration_minutes ELSE 0 END) as billable_minutes
      FROM time_entries te
      WHERE te.is_running = 0 ${dateFilter}
      GROUP BY DATE(te.start_time)
      ORDER BY date ASC
    `).all(...params);

    // Totals
    const totals = await db.prepare(`
      SELECT
        SUM(te.duration_minutes) as total_minutes,
        SUM(CASE WHEN te.billable = 1 THEN te.duration_minutes ELSE 0 END) as billable_minutes,
        SUM(CASE WHEN te.billable = 0 THEN te.duration_minutes ELSE 0 END) as non_billable_minutes,
        COUNT(te.id) as entry_count
      FROM time_entries te
      WHERE te.is_running = 0 ${dateFilter}
    `).get(...params);

    res.json({
      by_project: byProject,
      by_user: byUser,
      by_day: byDay,
      totals: {
        ...totals,
        total_hours: Math.round((totals.total_minutes || 0) / 60 * 100) / 100,
        billable_hours: Math.round((totals.billable_minutes || 0) / 60 * 100) / 100,
        non_billable_hours: Math.round((totals.non_billable_minutes || 0) / 60 * 100) / 100
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get time entry by ID
router.get('/:id', async (req, res) => {
  try {
    const entry = await db.prepare(`
      SELECT te.*,
        t.title as task_title,
        p.name as project_name,
        tm.name as user_name
      FROM time_entries te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN team_members tm ON te.user_id = tm.id
      WHERE te.id = ?
    `).get(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual time entry
router.post('/', async (req, res) => {
  try {
    const {
      task_id,
      project_id,
      user_id,
      description,
      start_time,
      end_time,
      duration_minutes,
      billable = true,
      hourly_rate
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    if (!start_time) {
      return res.status(400).json({ error: 'start_time is required' });
    }

    // Calculate duration if end_time provided but no duration
    let finalDuration = duration_minutes;
    if (end_time && !duration_minutes) {
      const start = new Date(start_time);
      const end = new Date(end_time);
      finalDuration = Math.round((end - start) / 60000);
    }

    // If task_id provided, get project_id from task
    let finalProjectId = project_id;
    if (task_id && !project_id) {
      const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(task_id);
      if (task) {
        finalProjectId = task.project_id;
      }
    }

    const result = await db.prepare(`
      INSERT INTO time_entries (
        task_id, project_id, user_id, description,
        start_time, end_time, duration_minutes,
        is_running, billable, hourly_rate
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      task_id || null,
      finalProjectId || null,
      user_id,
      description || null,
      start_time,
      end_time || null,
      finalDuration || null,
      billable ? 1 : 0,
      hourly_rate || null
    );

    const newEntry = await db.prepare(`
      SELECT te.*,
        t.title as task_title,
        p.name as project_name,
        tm.name as user_name
      FROM time_entries te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN team_members tm ON te.user_id = tm.id
      WHERE te.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newEntry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start timer
router.post('/start', async (req, res) => {
  try {
    const { task_id, project_id, user_id, description } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Get current time in ISO format
    const now = new Date().toISOString();

    // Stop any existing running timers for this user
    const existingTimers = await db.prepare('SELECT * FROM time_entries WHERE user_id = ? AND is_running = 1').all(user_id);
    for (const timer of existingTimers) {
      const startTime = new Date(timer.start_time.includes('T') ? timer.start_time : timer.start_time.replace(' ', 'T') + 'Z');
      const duration = Math.floor((new Date() - startTime) / 60000);
      await db.prepare(`
        UPDATE time_entries
        SET is_running = 0,
            end_time = ?,
            duration_minutes = ?,
            updated_at = ?
        WHERE id = ?
      `).run(now, duration, now, timer.id);
    }

    // If task_id provided, get project_id from task
    let finalProjectId = project_id;
    if (task_id && !project_id) {
      const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(task_id);
      if (task) {
        finalProjectId = task.project_id;
      }
    }

    // Start new timer with ISO timestamp
    const result = await db.prepare(`
      INSERT INTO time_entries (
        task_id, project_id, user_id, description,
        start_time, is_running, billable
      )
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(
      task_id || null,
      finalProjectId || null,
      user_id,
      description || null,
      now
    );

    const newEntry = await db.prepare(`
      SELECT te.*,
        t.title as task_title,
        p.name as project_name,
        tm.name as user_name
      FROM time_entries te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN team_members tm ON te.user_id = tm.id
      WHERE te.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newEntry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop timer
router.post('/:id/stop', async (req, res) => {
  try {
    const { description } = req.body;
    const entryId = req.params.id;

    const entry = await db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId);

    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    if (!entry.is_running) {
      return res.status(400).json({ error: 'Timer is not running' });
    }

    // Calculate duration properly handling timezone
    const now = new Date();
    const nowISO = now.toISOString();
    const startTime = new Date(
      entry.start_time.includes('T')
        ? entry.start_time
        : entry.start_time.replace(' ', 'T') + 'Z'
    );
    const durationMinutes = Math.max(1, Math.floor((now - startTime) / 60000));

    // Update with calculated duration
    if (description) {
      await db.prepare(`
        UPDATE time_entries
        SET is_running = 0,
            end_time = ?,
            duration_minutes = ?,
            description = ?,
            updated_at = ?
        WHERE id = ?
      `).run(nowISO, durationMinutes, description, nowISO, entryId);
    } else {
      await db.prepare(`
        UPDATE time_entries
        SET is_running = 0,
            end_time = ?,
            duration_minutes = ?,
            updated_at = ?
        WHERE id = ?
      `).run(nowISO, durationMinutes, nowISO, entryId);
    }

    const updatedEntry = await db.prepare(`
      SELECT te.*,
        t.title as task_title,
        p.name as project_name,
        tm.name as user_name
      FROM time_entries te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN team_members tm ON te.user_id = tm.id
      WHERE te.id = ?
    `).get(entryId);

    res.json(updatedEntry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update time entry
router.put('/:id', async (req, res) => {
  try {
    const {
      task_id,
      project_id,
      description,
      start_time,
      end_time,
      duration_minutes,
      billable,
      hourly_rate
    } = req.body;

    const entry = await db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    // Calculate duration if end_time changed
    let finalDuration = duration_minutes !== undefined ? duration_minutes : entry.duration_minutes;
    if (end_time && start_time && duration_minutes === undefined) {
      const start = new Date(start_time || entry.start_time);
      const end = new Date(end_time);
      finalDuration = Math.round((end - start) / 60000);
    }

    await db.prepare(`
      UPDATE time_entries SET
        task_id = COALESCE(?, task_id),
        project_id = COALESCE(?, project_id),
        description = COALESCE(?, description),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        duration_minutes = ?,
        billable = COALESCE(?, billable),
        hourly_rate = COALESCE(?, hourly_rate),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      task_id,
      project_id,
      description,
      start_time,
      end_time,
      finalDuration,
      billable !== undefined ? (billable ? 1 : 0) : null,
      hourly_rate,
      req.params.id
    );

    const updatedEntry = await db.prepare(`
      SELECT te.*,
        t.title as task_title,
        p.name as project_name,
        tm.name as user_name
      FROM time_entries te
      LEFT JOIN tasks t ON te.task_id = t.id
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN team_members tm ON te.user_id = tm.id
      WHERE te.id = ?
    `).get(req.params.id);

    res.json(updatedEntry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete time entry
router.delete('/:id', async (req, res) => {
  try {
    const entry = await db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    await db.prepare('DELETE FROM time_entries WHERE id = ?').run(req.params.id);
    res.json({ message: 'Time entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get time logged for a specific task
router.get('/task/:taskId/summary', async (req, res) => {
  try {
    const summary = await db.prepare(`
      SELECT
        SUM(duration_minutes) as total_minutes,
        COUNT(id) as entry_count
      FROM time_entries
      WHERE task_id = ? AND is_running = 0
    `).get(req.params.taskId);

    // Get task estimated hours
    const task = await db.prepare('SELECT estimated_hours FROM tasks WHERE id = ?').get(req.params.taskId);

    res.json({
      total_minutes: summary.total_minutes || 0,
      total_hours: Math.round((summary.total_minutes || 0) / 60 * 100) / 100,
      entry_count: summary.entry_count || 0,
      estimated_hours: task?.estimated_hours || 0,
      remaining_hours: task?.estimated_hours
        ? Math.max(0, task.estimated_hours - (summary.total_minutes || 0) / 60)
        : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
