import db from '../config/database.js';

// Resolve organization_id from a task via its project
const getOrgIdFromTask = async (taskId) => {
  const row = await db.prepare(`
    SELECT p.organization_id FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(taskId);
  return row?.organization_id || null;
};

/**
 * Create a notification
 * @param {number} userId - ID del usuario que recibirá la notificación
 * @param {string} type - Tipo de notificación
 * @param {string} title - Título de la notificación
 * @param {string} message - Mensaje de la notificación
 * @param {string} entityType - Tipo de entidad (task, comment, etc.)
 * @param {number} entityId - ID de la entidad
 * @param {object} metadata - Metadata adicional
 */
export const createNotification = async (userId, type, title, message, entityType = null, entityId = null, metadata = null, orgId = null) => {
  try {
    const result = await db.prepare(`
      INSERT INTO notifications (
        user_id, type, title, message, entity_type, entity_id, metadata, organization_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      type,
      title,
      message,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
      orgId
    );

    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

/**
 * Notificar cuando se asigna una tarea
 * @param {number|number[]} assignedToIds - ID o array de IDs de los asignados
 */
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

/**
 * Notificar cuando hay un nuevo comentario en una tarea (a todos los assignees)
 */
export const notifyNewComment = async (taskId, taskTitle, commentId, commenterId, commentText) => {
  const task = await db.prepare('SELECT assigned_to, project_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return;

  const commenter = await db.prepare('SELECT name FROM team_members WHERE id = ?').get(commenterId);
  const commenterName = commenter ? commenter.name : 'Alguien';
  const orgId = await getOrgIdFromTask(taskId);

  // Get all assignees from junction table
  const assignees = await db.all(
    'SELECT team_member_id FROM task_assignees WHERE task_id = ?',
    [taskId]
  );
  const assigneeIds = assignees.map(a => a.team_member_id);

  // Fallback to assigned_to if no entries in task_assignees
  if (assigneeIds.length === 0 && task.assigned_to) {
    assigneeIds.push(task.assigned_to);
  }

  for (const assigneeId of assigneeIds) {
    if (assigneeId && assigneeId !== commenterId) {
      await createNotification(
        assigneeId,
        'comment',
        'Nuevo comentario',
        `${commenterName} comentó en "${taskTitle}": ${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}`,
        'comment',
        commentId,
        { task_id: taskId, commenter_id: commenterId },
        orgId
      );
    }
  }
};

/**
 * Notificar menciones en comentarios
 */
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
        orgId
      );
    }
  }
};

/**
 * Notificar cuando se actualiza una tarea importante
 * @param {number|number[]} assignedToIds - ID o array de IDs de los asignados
 */
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

/**
 * Notificar cuando una tarea está próxima a vencer
 */
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

/**
 * Notificar cuando una tarea se marca como completada
 */
export const notifyTaskCompleted = async (taskId, taskTitle, completedById) => {
  const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return;

  const project = await db.prepare('SELECT name, organization_id FROM projects WHERE id = ?').get(task.project_id);
  const completedBy = await db.prepare('SELECT name FROM team_members WHERE id = ?').get(completedById);
  const completedByName = completedBy ? completedBy.name : 'Alguien';
  const orgId = project?.organization_id || null;

  // Notify managers/admins in the same org
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

export default {
  createNotification,
  notifyTaskAssigned,
  notifyNewComment,
  notifyMentions,
  notifyTaskUpdated,
  notifyTaskDueSoon,
  notifyTaskCompleted
};
