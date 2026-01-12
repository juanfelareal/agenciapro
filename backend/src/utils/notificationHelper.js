import db from '../config/database.js';

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
export const createNotification = (userId, type, title, message, entityType = null, entityId = null, metadata = null) => {
  try {
    const result = db.prepare(`
      INSERT INTO notifications (
        user_id, type, title, message, entity_type, entity_id, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      type,
      title,
      message,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null
    );

    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

/**
 * Notificar cuando se asigna una tarea
 */
export const notifyTaskAssigned = (taskId, taskTitle, assignedToId, assignedById) => {
  if (!assignedToId || assignedToId === assignedById) return;

  const assignedBy = db.prepare('SELECT name FROM team_members WHERE id = ?').get(assignedById);
  const assignedByName = assignedBy ? assignedBy.name : 'Alguien';

  createNotification(
    assignedToId,
    'task_assigned',
    'Nueva tarea asignada',
    `${assignedByName} te ha asignado la tarea: "${taskTitle}"`,
    'task',
    taskId,
    { assigned_by: assignedById }
  );
};

/**
 * Notificar cuando hay un nuevo comentario en una tarea
 */
export const notifyNewComment = (taskId, taskTitle, commentId, commenterId, commentText) => {
  // Obtener información de la tarea
  const task = db.prepare('SELECT assigned_to, project_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return;

  const commenter = db.prepare('SELECT name FROM team_members WHERE id = ?').get(commenterId);
  const commenterName = commenter ? commenter.name : 'Alguien';

  // Notificar al asignado (si no es el que comentó)
  if (task.assigned_to && task.assigned_to !== commenterId) {
    createNotification(
      task.assigned_to,
      'comment',
      'Nuevo comentario',
      `${commenterName} comentó en "${taskTitle}": ${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}`,
      'comment',
      commentId,
      { task_id: taskId, commenter_id: commenterId }
    );
  }

  // TODO: Notificar a otros participantes de la tarea (futuros watchers)
};

/**
 * Notificar menciones en comentarios
 */
export const notifyMentions = (commentText, taskId, taskTitle, commentId, mentionerId) => {
  // Extraer menciones (@usuario)
  const mentionRegex = /@(\w+)/g;
  const mentions = [...commentText.matchAll(mentionRegex)].map(m => m[1]);

  if (mentions.length === 0) return;

  const mentioner = db.prepare('SELECT name FROM team_members WHERE id = ?').get(mentionerId);
  const mentionerName = mentioner ? mentioner.name : 'Alguien';

  // Buscar usuarios mencionados por nombre o email
  mentions.forEach(mention => {
    const user = db.prepare(`
      SELECT id FROM team_members
      WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ?
      LIMIT 1
    `).get(`%${mention.toLowerCase()}%`, `%${mention.toLowerCase()}%`);

    if (user && user.id !== mentionerId) {
      createNotification(
        user.id,
        'mention',
        'Te han mencionado',
        `${mentionerName} te mencionó en "${taskTitle}"`,
        'comment',
        commentId,
        { task_id: taskId, mentioner_id: mentionerId }
      );
    }
  });
};

/**
 * Notificar cuando se actualiza una tarea importante
 */
export const notifyTaskUpdated = (taskId, taskTitle, assignedToId, updatedById, changes) => {
  if (!assignedToId || assignedToId === updatedById) return;

  const updatedBy = db.prepare('SELECT name FROM team_members WHERE id = ?').get(updatedById);
  const updatedByName = updatedBy ? updatedBy.name : 'Alguien';

  const changesList = Object.keys(changes).join(', ');

  createNotification(
    assignedToId,
    'task_updated',
    'Tarea actualizada',
    `${updatedByName} actualizó "${taskTitle}" (${changesList})`,
    'task',
    taskId,
    { updated_by: updatedById, changes }
  );
};

/**
 * Notificar cuando una tarea está próxima a vencer
 */
export const notifyTaskDueSoon = (taskId, taskTitle, assignedToId, dueDate) => {
  if (!assignedToId) return;

  createNotification(
    assignedToId,
    'task_due',
    'Tarea próxima a vencer',
    `La tarea "${taskTitle}" vence el ${new Date(dueDate).toLocaleDateString('es-ES')}`,
    'task',
    taskId,
    { due_date: dueDate }
  );
};

/**
 * Notificar cuando una tarea se marca como completada
 */
export const notifyTaskCompleted = (taskId, taskTitle, completedById) => {
  // Obtener el proyecto y notificar a managers/admins
  const task = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return;

  const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(task.project_id);
  const completedBy = db.prepare('SELECT name FROM team_members WHERE id = ?').get(completedById);
  const completedByName = completedBy ? completedBy.name : 'Alguien';

  // Notificar a managers y admins
  const managers = db.prepare(`
    SELECT id FROM team_members
    WHERE (role = 'manager' OR role = 'admin') AND status = 'active' AND id != ?
  `).all(completedById);

  managers.forEach(manager => {
    createNotification(
      manager.id,
      'task_completed',
      'Tarea completada',
      `${completedByName} completó la tarea "${taskTitle}" en ${project ? project.name : 'el proyecto'}`,
      'task',
      taskId,
      { completed_by: completedById }
    );
  });
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
