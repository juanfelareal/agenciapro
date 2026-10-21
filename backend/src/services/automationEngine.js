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

// Helper: get org_id from a task's project
const getOrgIdFromTask = async (task) => {
  if (task.organization_id) return task.organization_id;
  if (task.project_id) {
    const project = await db.prepare('SELECT organization_id FROM projects WHERE id = ?').get(task.project_id);
    return project?.organization_id || null;
  }
  return null;
};

// Process automations when a task is created
export const processTaskCreated = async (task) => {
  try {
    const orgId = await getOrgIdFromTask(task);

    // Get active automations for this project or global automations (scoped by org)
    const automations = await db.prepare(`
      SELECT * FROM automations
      WHERE is_active = 1
      AND trigger_type = 'task_created'
      AND (project_id = ? OR project_id IS NULL)
      AND organization_id = ?
    `).all(task.project_id, orgId);

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
    const orgId = await getOrgIdFromTask(newTask);

    // Status change trigger
    if (oldTask.status !== newTask.status) {
      const statusAutomations = await db.prepare(`
        SELECT * FROM automations
        WHERE is_active = 1
        AND trigger_type = 'status_change'
        AND (project_id = ? OR project_id IS NULL)
        AND organization_id = ?
      `).all(newTask.project_id, orgId);

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
        AND organization_id = ?
      `).all(newTask.project_id, orgId);

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
        AND organization_id = ?
      `).all(newTask.project_id, orgId);

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

  // Multi-tenant guard: la automatización y la tarea deben ser de la misma organización
  const taskOrgId = await getOrgIdFromTask(task);
  if (automation.organization_id && taskOrgId && Number(automation.organization_id) !== Number(taskOrgId)) {
    console.warn(`⚠️ Skipped automation "${automation.name}": org mismatch (automation ${automation.organization_id}, task ${taskOrgId})`);
    return;
  }

  console.log(`⚡ Executing automation: "${automation.name}" on task "${task.title}"`);

  try {
    switch (automation.action_type) {
      case 'change_status':
        if (params.status) {
          await db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?')
            .run(params.status, task.id, automation.organization_id);
          console.log(`  → Changed status to: ${params.status}`);
        }
        break;

      case 'assign_user':
        if (params.user_id) {
          // Multi-tenant: solo miembros de la misma organización que la tarea
          const orgIdForAssign = await getOrgIdFromTask(task);
          const member = await db.prepare('SELECT id FROM team_members WHERE id = ? AND organization_id = ?')
            .get(params.user_id, orgIdForAssign);
          if (!member) {
            console.warn(`  → Skipped assign_user: member ${params.user_id} is not in org ${orgIdForAssign}`);
            break;
          }
          await db.prepare('UPDATE tasks SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?')
            .run(params.user_id, task.id, orgIdForAssign);
          await db.prepare('INSERT INTO task_assignees (task_id, team_member_id, organization_id) VALUES (?, ?, ?) ON CONFLICT (task_id, team_member_id) DO NOTHING')
            .run(task.id, params.user_id, orgIdForAssign);
          await notifyTaskAssigned(task.id, task.title, params.user_id, 0);
          console.log(`  → Assigned to user: ${params.user_id}`);
        }
        break;

      case 'add_tag':
        if (params.tag_id) {
          // Multi-tenant: solo etiquetas de la misma organización que la tarea
          const orgIdForTag = await getOrgIdFromTask(task);
          const tag = await db.prepare('SELECT id FROM tags WHERE id = ? AND organization_id = ?')
            .get(params.tag_id, orgIdForTag);
          if (!tag) {
            console.warn(`  → Skipped add_tag: tag ${params.tag_id} is not in org ${orgIdForTag}`);
            break;
          }
          // task_tags PK (task_id, tag_id): idempotente
          await db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?) ON CONFLICT (task_id, tag_id) DO NOTHING')
            .run(task.id, params.tag_id);
          console.log(`  → Added tag: ${params.tag_id}`);
        }
        break;

      case 'send_notification':
        if (params.message) {
          const notifOrgId = await getOrgIdFromTask(task);
          // Get all assignees from junction table, fallback to assigned_to
          let recipientIds = [];
          if (params.user_id) {
            // Solo si el destinatario pertenece a la organización de la tarea
            const recipient = await db.prepare('SELECT id FROM team_members WHERE id = ? AND organization_id = ?')
              .get(params.user_id, notifOrgId);
            recipientIds = recipient ? [params.user_id] : [];
          } else {
            const assignees = await db.prepare('SELECT team_member_id FROM task_assignees WHERE task_id = ?').all(task.id);
            recipientIds = assignees.map(a => a.team_member_id);
            if (recipientIds.length === 0 && task.assigned_to) {
              recipientIds = [task.assigned_to];
            }
          }
          for (const recipientId of recipientIds) {
            await db.prepare(`
              INSERT INTO notifications (user_id, type, category, title, message, related_task_id, organization_id)
              VALUES (?, 'automation', 'system', ?, ?, ?, ?)
            `).run(recipientId, `Automatización: ${automation.name}`, params.message, task.id, notifOrgId);
            console.log(`  → Sent notification to user: ${recipientId}`);
          }
        }
        break;

      case 'change_priority':
        if (params.priority) {
          await db.prepare('UPDATE tasks SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?')
            .run(params.priority, task.id, automation.organization_id);
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
    // Check if automation_logs table exists (PostgreSQL)
    const tableExists = await db.prepare(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'automation_logs'
    `).get();

    if (!tableExists) {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS automation_logs (
          id SERIAL PRIMARY KEY,
          automation_id INTEGER NOT NULL,
          task_id INTEGER NOT NULL,
          success INTEGER DEFAULT 1,
          error_message TEXT,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

      // Find tasks with due dates approaching, scoped by automation's org via project
      const tasks = await db.prepare(`
        SELECT t.* FROM tasks t
        WHERE t.due_date IS NOT NULL
        AND t.status != 'done'
        AND t.due_date::DATE = CURRENT_DATE + (? || ' days')::INTERVAL
        AND (? IS NULL OR t.project_id = ?)
        AND t.organization_id = ?
      `).all(daysBefore, automation.project_id, automation.project_id, automation.organization_id);

      for (const task of tasks) {
        task.organization_id = automation.organization_id;
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
