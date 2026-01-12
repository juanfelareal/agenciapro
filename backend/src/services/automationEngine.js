import db from '../config/database.js';
import { notifyTaskAssigned, notifyTaskUpdated, notifyTaskCompleted } from '../utils/notificationHelper.js';

/**
 * Automation Engine
 * Processes automations when tasks are created or updated
 *
 * Trigger Types:
 * - task_created: When a new task is created
 * - status_change: When task status changes to specific value
 * - task_assigned: When task is assigned to someone
 * - priority_change: When task priority changes
 *
 * Action Types:
 * - change_status: Change task status
 * - assign_user: Assign task to a user
 * - add_tag: Add a tag to the task
 * - send_notification: Create a notification
 * - change_priority: Change task priority
 */

// Process automations when a task is created
export const processTaskCreated = async (task) => {
  try {
    // Get active automations for this project or global automations
    const automations = await db.prepare(`
      SELECT * FROM automations
      WHERE is_active = 1
      AND trigger_type = 'task_created'
      AND (project_id = ? OR project_id IS NULL)
    `).all(task.project_id);

    for (const automation of automations) {
      const conditions = automation.trigger_conditions ? JSON.parse(automation.trigger_conditions) : {};

      // Check if conditions match
      if (matchesConditions(task, conditions)) {
        await executeAction(task, automation);
      }
    }
  } catch (error) {
    console.error('Error processing task_created automations:', error);
  }
};

// Process automations when a task is updated
export const processTaskUpdated = async (oldTask, newTask) => {
  try {
    // Status change trigger
    if (oldTask.status !== newTask.status) {
      const statusAutomations = await db.prepare(`
        SELECT * FROM automations
        WHERE is_active = 1
        AND trigger_type = 'status_change'
        AND (project_id = ? OR project_id IS NULL)
      `).all(newTask.project_id);

      for (const automation of statusAutomations) {
        const conditions = automation.trigger_conditions ? JSON.parse(automation.trigger_conditions) : {};

        // Check if the new status matches the trigger condition
        if (conditions.from_status && conditions.from_status !== oldTask.status) continue;
        if (conditions.to_status && conditions.to_status !== newTask.status) continue;

        await executeAction(newTask, automation, { oldTask });
      }
    }

    // Assignment trigger
    if (oldTask.assigned_to !== newTask.assigned_to && newTask.assigned_to) {
      const assignAutomations = await db.prepare(`
        SELECT * FROM automations
        WHERE is_active = 1
        AND trigger_type = 'task_assigned'
        AND (project_id = ? OR project_id IS NULL)
      `).all(newTask.project_id);

      for (const automation of assignAutomations) {
        const conditions = automation.trigger_conditions ? JSON.parse(automation.trigger_conditions) : {};

        // Check if assigned to specific user
        if (conditions.assigned_to && conditions.assigned_to !== newTask.assigned_to) continue;

        await executeAction(newTask, automation, { oldTask });
      }
    }

    // Priority change trigger
    if (oldTask.priority !== newTask.priority) {
      const priorityAutomations = await db.prepare(`
        SELECT * FROM automations
        WHERE is_active = 1
        AND trigger_type = 'priority_change'
        AND (project_id = ? OR project_id IS NULL)
      `).all(newTask.project_id);

      for (const automation of priorityAutomations) {
        const conditions = automation.trigger_conditions ? JSON.parse(automation.trigger_conditions) : {};

        if (conditions.from_priority && conditions.from_priority !== oldTask.priority) continue;
        if (conditions.to_priority && conditions.to_priority !== newTask.priority) continue;

        await executeAction(newTask, automation, { oldTask });
      }
    }
  } catch (error) {
    console.error('Error processing task_updated automations:', error);
  }
};

// Check if task matches automation conditions
const matchesConditions = (task, conditions) => {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  if (conditions.status && task.status !== conditions.status) return false;
  if (conditions.priority && task.priority !== conditions.priority) return false;
  if (conditions.assigned_to && task.assigned_to !== conditions.assigned_to) return false;
  if (conditions.has_due_date !== undefined) {
    if (conditions.has_due_date && !task.due_date) return false;
    if (!conditions.has_due_date && task.due_date) return false;
  }

  return true;
};

// Execute automation action
const executeAction = async (task, automation, context = {}) => {
  const params = automation.action_params ? JSON.parse(automation.action_params) : {};

  console.log(`⚡ Executing automation: "${automation.name}" on task "${task.title}"`);

  try {
    switch (automation.action_type) {
      case 'change_status':
        if (params.status) {
          await db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(params.status, task.id);
          console.log(`  → Changed status to: ${params.status}`);
        }
        break;

      case 'assign_user':
        if (params.user_id) {
          await db.prepare('UPDATE tasks SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(params.user_id, task.id);
          await notifyTaskAssigned(task.id, task.title, params.user_id, 0);
          console.log(`  → Assigned to user: ${params.user_id}`);
        }
        break;

      case 'add_tag':
        if (params.tag_id) {
          // Check if tag is already added
          const existing = await db.prepare('SELECT id FROM task_tags WHERE task_id = ? AND tag_id = ?')
            .get(task.id, params.tag_id);

          if (!existing) {
            await db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)')
              .run(task.id, params.tag_id);
            console.log(`  → Added tag: ${params.tag_id}`);
          }
        }
        break;

      case 'send_notification':
        if (params.message) {
          const recipientId = params.user_id || task.assigned_to;
          if (recipientId) {
            await db.prepare(`
              INSERT INTO notifications (user_id, type, title, message, related_task_id)
              VALUES (?, 'automation', ?, ?, ?)
            `).run(recipientId, `Automatización: ${automation.name}`, params.message, task.id);
            console.log(`  → Sent notification to user: ${recipientId}`);
          }
        }
        break;

      case 'change_priority':
        if (params.priority) {
          await db.prepare('UPDATE tasks SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(params.priority, task.id);
          console.log(`  → Changed priority to: ${params.priority}`);
        }
        break;

      default:
        console.log(`  → Unknown action type: ${automation.action_type}`);
    }

    // Log automation execution
    await logAutomationExecution(automation.id, task.id, true);
  } catch (error) {
    console.error(`  → Error executing action: ${error.message}`);
    await logAutomationExecution(automation.id, task.id, false, error.message);
  }
};

// Log automation execution for history tracking
const logAutomationExecution = async (automationId, taskId, success, errorMessage = null) => {
  try {
    // Check if automation_logs table exists
    const tableExists = await db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='automation_logs'
    `).get();

    if (!tableExists) {
      db.exec(`
        CREATE TABLE automation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          automation_id INTEGER NOT NULL,
          task_id INTEGER NOT NULL,
          success INTEGER DEFAULT 1,
          error_message TEXT,
          executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
      `);
    }

    await db.prepare(`
      INSERT INTO automation_logs (automation_id, task_id, success, error_message)
      VALUES (?, ?, ?, ?)
    `).run(automationId, taskId, success ? 1 : 0, errorMessage);
  } catch (error) {
    console.error('Error logging automation execution:', error);
  }
};

// Check for due date approaching automations (to be run by cron)
export const checkDueDateAutomations = async () => {
  try {
    const automations = await db.prepare(`
      SELECT * FROM automations
      WHERE is_active = 1
      AND trigger_type = 'due_date_approaching'
    `).all();

    for (const automation of automations) {
      const conditions = automation.trigger_conditions ? JSON.parse(automation.trigger_conditions) : {};
      const daysBefore = conditions.days_before || 1;

      // Find tasks with due dates approaching
      const tasks = await db.prepare(`
        SELECT * FROM tasks
        WHERE due_date IS NOT NULL
        AND status != 'done'
        AND date(due_date) = date('now', '+' || ? || ' days')
        AND (? IS NULL OR project_id = ?)
      `).all(daysBefore, automation.project_id, automation.project_id);

      for (const task of tasks) {
        await executeAction(task, automation);
      }
    }
  } catch (error) {
    console.error('Error checking due date automations:', error);
  }
};

export default {
  processTaskCreated,
  processTaskUpdated,
  checkDueDateAutomations,
};
