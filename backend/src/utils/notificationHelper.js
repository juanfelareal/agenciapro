import db from '../config/database.js';
import { sendEmail } from './emailHelper.js';

// ============================================================
// CATEGORIES — used by the Inbox tabs
// ============================================================
const TYPE_TO_CATEGORY = {
  // Client actions (from the portal)
  client_approved: 'client_action',
  client_rejected: 'client_action',
  client_changes_requested: 'client_action',
  client_comment: 'client_action',
  client_task_created: 'client_action',
  client_form_submitted: 'client_action',
  // Tasks (internal team activity)
  task_assigned: 'task',
  task_updated: 'task',
  task_due: 'task',
  task_completed: 'task',
  form_assigned: 'task',
  // Team conversations
  comment: 'comment',
  mention: 'comment',
  // Finance
  invoice_created: 'finance',
  invoice_paid: 'finance',
  commission_approved: 'finance',
  // System / automation
  automation: 'system',
  chat_message: 'system',
  info: 'system',
};

const categoryFor = (type) => TYPE_TO_CATEGORY[type] || 'system';

// ============================================================
// Internal helpers
// ============================================================

// Resolve organization_id from a task via its project
const getOrgIdFromTask = async (taskId) => {
  const row = await db.prepare(`
    SELECT COALESCE(p.organization_id, t.organization_id) AS organization_id
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(taskId);
  return row?.organization_id || null;
};

/**
 * Returns the unique set of team_members that should receive notifications
 * about this task. Includes:
 *   - All current assignees (from task_assignees junction)
 *   - The task's creator (created_by)
 *   - The legacy `assigned_to` column as a safety net
 * Optionally excludes a set of ids (e.g. the actor who triggered the event).
 *
 * @returns {Array<{id:number, name:string, email:string|null}>}
 */
export const getTaskRecipients = async (taskId, { excludeIds = [] } = {}) => {
  const task = await db.prepare(
    'SELECT id, project_id, assigned_to, created_by FROM tasks WHERE id = ?'
  ).get(taskId);
  if (!task) return [];

  const assignees = await db.all(
    'SELECT team_member_id FROM task_assignees WHERE task_id = ?',
    [taskId]
  );

  const ids = new Set();
  for (const a of assignees) if (a.team_member_id) ids.add(a.team_member_id);
  if (task.assigned_to) ids.add(task.assigned_to);
  if (task.created_by) ids.add(task.created_by);

  // Fallback: if the task has nobody yet (e.g. just created by a client),
  // fan-out to the project_team so at least someone in the agency hears.
  if (ids.size === 0 && task.project_id) {
    const members = await db.all(
      'SELECT team_member_id FROM project_team WHERE project_id = ?',
      [task.project_id]
    );
    for (const m of members) if (m.team_member_id) ids.add(m.team_member_id);
  }

  for (const x of excludeIds) ids.delete(x);
  if (ids.size === 0) return [];

  const placeholders = [...ids].map(() => '?').join(',');
  const rows = await db.all(
    `SELECT id, name, email FROM team_members
     WHERE id IN (${placeholders}) AND status = 'active'`,
    [...ids]
  );
  return rows;
};

// ============================================================
// Core insert
// ============================================================

/**
 * Create a single notification row.
 * Category is derived from `type` automatically unless overridden.
 */
export const createNotification = async (
  userId, type, title, message,
  entityType = null, entityId = null, metadata = null, orgId = null,
  { category, relatedTaskId } = {}
) => {
  try {
    const finalCategory = category || categoryFor(type);
    const result = await db.prepare(`
      INSERT INTO notifications (
        user_id, type, category, title, message,
        entity_type, entity_id, related_task_id, metadata, organization_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      type,
      finalCategory,
      title,
      message,
      entityType,
      entityId,
      relatedTaskId || (entityType === 'task' ? entityId : null),
      metadata ? JSON.stringify(metadata) : null,
      orgId
    );
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// ============================================================
// TEAM ACTIONS (existing helpers — preserved API, now category-aware)
// ============================================================

export const notifyTaskAssigned = async (taskId, taskTitle, assignedToIds, assignedById) => {
  const ids = Array.isArray(assignedToIds) ? assignedToIds : [assignedToIds];
  if (ids.length === 0) return;

  const assignedBy = await db.prepare('SELECT name FROM team_members WHERE id = ?').get(assignedById);
  const assignedByName = assignedBy ? assignedBy.name : 'Alguien';
  const orgId = await getOrgIdFromTask(taskId);

  for (const assignedToId of ids) {
    if (!assignedToId || assignedToId === assignedById) continue;
    await createNotification(
      assignedToId,
      'task_assigned',
      'Nueva tarea asignada',
      `${assignedByName} te ha asignado la tarea: "${taskTitle}"`,
      'task',
      taskId,
      { assigned_by: assignedById },
      orgId
    );
  }
};

export const notifyNewComment = async (taskId, taskTitle, commentId, commenterId, commentText) => {
  const task = await db.prepare('SELECT assigned_to, project_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return;

  const commenter = await db.prepare('SELECT name FROM team_members WHERE id = ?').get(commenterId);
  const commenterName = commenter ? commenter.name : 'Alguien';
  const orgId = await getOrgIdFromTask(taskId);

  const recipients = await getTaskRecipients(taskId, { excludeIds: [commenterId] });
  for (const r of recipients) {
    await createNotification(
      r.id,
      'comment',
      'Nuevo comentario',
      `${commenterName} comentó en "${taskTitle}": ${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}`,
      'comment',
      commentId,
      { task_id: taskId, commenter_id: commenterId },
      orgId,
      { relatedTaskId: taskId }
    );
  }
};

export const notifyMentions = async (commentText, taskId, taskTitle, commentId, mentionerId) => {
  const mentionRegex = /@(\w+)/g;
  const mentions = [...commentText.matchAll(mentionRegex)].map(m => m[1]);
  if (mentions.length === 0) return;

  const mentioner = await db.prepare('SELECT name FROM team_members WHERE id = ?').get(mentionerId);
  const mentionerName = mentioner ? mentioner.name : 'Alguien';
  const orgId = await getOrgIdFromTask(taskId);

  for (const mention of mentions) {
    const user = await db.prepare(`
      SELECT id FROM team_members
      WHERE (LOWER(name) LIKE ? OR LOWER(email) LIKE ?) AND organization_id = ?
      LIMIT 1
    `).get(`%${mention.toLowerCase()}%`, `%${mention.toLowerCase()}%`, orgId);

    if (user && user.id !== mentionerId) {
      await createNotification(
        user.id,
        'mention',
        'Te han mencionado',
        `${mentionerName} te mencionó en "${taskTitle}"`,
        'comment',
        commentId,
        { task_id: taskId, mentioner_id: mentionerId },
        orgId,
        { relatedTaskId: taskId }
      );
    }
  }
};

export const notifyTaskUpdated = async (taskId, taskTitle, assignedToIds, updatedById, changes) => {
  const ids = Array.isArray(assignedToIds) ? assignedToIds : [assignedToIds];
  if (ids.length === 0) return;

  const updatedBy = await db.prepare('SELECT name FROM team_members WHERE id = ?').get(updatedById);
  const updatedByName = updatedBy ? updatedBy.name : 'Alguien';
  const orgId = await getOrgIdFromTask(taskId);
  const changesList = Object.keys(changes).join(', ');

  for (const assignedToId of ids) {
    if (!assignedToId || assignedToId === updatedById) continue;
    await createNotification(
      assignedToId,
      'task_updated',
      'Tarea actualizada',
      `${updatedByName} actualizó "${taskTitle}" (${changesList})`,
      'task',
      taskId,
      { updated_by: updatedById, changes },
      orgId
    );
  }
};

export const notifyTaskDueSoon = async (taskId, taskTitle, assignedToId, dueDate) => {
  if (!assignedToId) return;
  const orgId = await getOrgIdFromTask(taskId);
  await createNotification(
    assignedToId,
    'task_due',
    'Tarea próxima a vencer',
    `La tarea "${taskTitle}" vence el ${new Date(dueDate).toLocaleDateString('es-ES')}`,
    'task',
    taskId,
    { due_date: dueDate },
    orgId
  );
};

export const notifyTaskCompleted = async (taskId, taskTitle, completedById) => {
  const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return;

  const project = await db.prepare('SELECT name, organization_id FROM projects WHERE id = ?').get(task.project_id);
  const completedBy = await db.prepare('SELECT name FROM team_members WHERE id = ?').get(completedById);
  const completedByName = completedBy ? completedBy.name : 'Alguien';
  const orgId = project?.organization_id || null;

  const managers = await db.prepare(`
    SELECT id FROM team_members
    WHERE (role = 'manager' OR role = 'admin') AND status = 'active' AND id != ? AND organization_id = ?
  `).all(completedById, orgId);

  for (const manager of managers) {
    await createNotification(
      manager.id,
      'task_completed',
      'Tarea completada',
      `${completedByName} completó la tarea "${taskTitle}" en ${project ? project.name : 'el proyecto'}`,
      'task',
      taskId,
      { completed_by: completedById },
      orgId
    );
  }
};

// ============================================================
// CLIENT ACTIONS (NEW — fired from the client portal)
// All target the same recipient set: task assignees + creator (deduped).
// All also send email to recipients with a non-empty email address.
// ============================================================

const CLIENT_FRONTEND_URL = () => process.env.FRONTEND_URL || 'https://app.agenciapro.com';

// Build a simple HTML email body. Kept inline; no template engine.
const buildClientActionEmail = ({ heading, intro, taskTitle, taskUrl, notes, accentColor }) => `
<!DOCTYPE html><html><body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F8F9FB;color:#1A1A2E;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #EEF0F4;">
    <div style="padding:20px 24px;border-bottom:4px solid ${accentColor};">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;color:#64748B;text-transform:uppercase;">AgenciaPro · Acción del cliente</p>
      <h1 style="margin:0;font-size:18px;color:#1A1A2E;">${heading}</h1>
    </div>
    <div style="padding:20px 24px;font-size:14px;line-height:1.55;">
      <p style="margin:0 0 14px;">${intro}</p>
      <p style="margin:0 0 14px;"><strong>Tarea:</strong> ${taskTitle}</p>
      ${notes ? `<div style="background:#F8F9FB;padding:14px 16px;border-radius:10px;border-left:3px solid ${accentColor};white-space:pre-wrap;font-size:13px;">${notes}</div>` : ''}
      ${taskUrl ? `<p style="margin:20px 0 0;"><a href="${taskUrl}" style="background:${accentColor};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:600;font-size:13px;">Ver tarea</a></p>` : ''}
    </div>
    <div style="padding:14px 24px;background:#F8F9FB;font-size:11px;color:#94A3B8;">Notificación automática · responde directamente en la app.</div>
  </div>
</body></html>`;

const dispatchClientActionEmails = async ({ recipients, heading, intro, taskTitle, taskUrl, notes, accentColor }) => {
  if (!recipients?.length) return;
  const from = process.env.EMAIL_FROM || 'AgenciaPro <noreply@agenciapro.app>';
  for (const r of recipients) {
    if (!r.email) continue;
    try {
      await sendEmail({
        from,
        to: r.email,
        subject: heading,
        html: buildClientActionEmail({ heading, intro, taskTitle, taskUrl, notes, accentColor }),
      });
    } catch (e) {
      console.error('[notifyClient] email failed for', r.email, e.message);
    }
  }
};

/**
 * Shared payload builder for the four client actions.
 */
const fanoutClientAction = async ({
  taskId, type, title, accentColor,
  clientName, notes, intro, heading
}) => {
  const task = await db.prepare(
    'SELECT id, title, project_id, organization_id FROM tasks WHERE id = ?'
  ).get(taskId);
  if (!task) return;

  const orgId = task.organization_id || await getOrgIdFromTask(taskId);
  const recipients = await getTaskRecipients(taskId);
  if (!recipients.length) return;

  const taskUrl = `${CLIENT_FRONTEND_URL()}/app/tasks?task=${taskId}`;

  // In-app notification for every recipient
  for (const r of recipients) {
    await createNotification(
      r.id,
      type,
      title,
      `${clientName} en "${task.title}"${notes ? `: ${notes.substring(0, 140)}${notes.length > 140 ? '…' : ''}` : ''}`,
      'task',
      taskId,
      { client_name: clientName, notes: notes || null },
      orgId,
      { category: 'client_action', relatedTaskId: taskId }
    );
  }

  // Email parallel
  await dispatchClientActionEmails({
    recipients,
    heading: `${heading} · ${task.title}`,
    intro: `${clientName} ${intro} en su portal.`,
    taskTitle: task.title,
    taskUrl,
    notes,
    accentColor,
  });
};

export const notifyClientApproved = async ({ taskId, clientName, notes }) =>
  fanoutClientAction({
    taskId,
    type: 'client_approved',
    title: 'Cliente aprobó una tarea',
    heading: 'El cliente aprobó',
    intro: 'aprobó esta entrega',
    clientName,
    notes,
    accentColor: '#16A34A',
  });

export const notifyClientRejected = async ({ taskId, clientName, notes }) =>
  fanoutClientAction({
    taskId,
    type: 'client_rejected',
    title: 'Cliente rechazó una tarea',
    heading: 'El cliente rechazó',
    intro: 'rechazó esta entrega',
    clientName,
    notes,
    accentColor: '#DC2626',
  });

export const notifyClientChangesRequested = async ({ taskId, clientName, notes }) =>
  fanoutClientAction({
    taskId,
    type: 'client_changes_requested',
    title: 'Cliente pidió cambios',
    heading: 'El cliente pidió cambios',
    intro: 'solicitó cambios',
    clientName,
    notes,
    accentColor: '#D97706',
  });

export const notifyClientCommented = async ({ taskId, clientName, commentText }) =>
  fanoutClientAction({
    taskId,
    type: 'client_comment',
    title: 'Comentario del cliente',
    heading: 'Nuevo comentario del cliente',
    intro: 'dejó un comentario',
    clientName,
    notes: commentText,
    accentColor: '#DB2777',
  });

export const notifyClientTaskCreated = async ({ taskId, clientName }) =>
  fanoutClientAction({
    taskId,
    type: 'client_task_created',
    title: 'Cliente creó una tarea',
    heading: 'Nueva tarea del cliente',
    intro: 'creó una nueva tarea',
    clientName,
    notes: null,
    accentColor: '#6366F1',
  });

export default {
  createNotification,
  getTaskRecipients,
  // team
  notifyTaskAssigned,
  notifyNewComment,
  notifyMentions,
  notifyTaskUpdated,
  notifyTaskDueSoon,
  notifyTaskCompleted,
  // client
  notifyClientApproved,
  notifyClientRejected,
  notifyClientChangesRequested,
  notifyClientCommented,
  notifyClientTaskCreated,
};
