import db from '../config/database.js';

/**
 * Fire-and-forget logger for the audit/history feed.
 * Never crashes the caller — if the INSERT fails (e.g. column missing on an
 * old environment), we just console.error and continue.
 *
 * Schema (see backend/src/config/database.js):
 *   activity_log (id, entity_type, entity_id, user_id, action, description,
 *                 metadata TEXT, created_at, organization_id)
 *
 * @param {Object} entry
 * @param {string} entry.entityType      e.g. 'task', 'project'
 * @param {number} entry.entityId        primary id of the entity
 * @param {string} entry.action          short verb: 'status_changed', 'created', etc.
 * @param {string} [entry.description]   human-readable text shown in UI
 * @param {Object} [entry.metadata]      structured payload (e.g. {from, to})
 * @param {number} [entry.userId]        team_member.id (null for client/system)
 * @param {number} [entry.orgId]         organization scope
 */
export async function logActivity({
  entityType,
  entityId,
  action,
  description = null,
  metadata = null,
  userId = null,
  orgId = null,
}) {
  if (!entityType || !entityId || !action) {
    console.warn('[activityLog] missing required field', { entityType, entityId, action });
    return;
  }

  try {
    await db.run(
      `INSERT INTO activity_log
         (entity_type, entity_id, user_id, action, description, metadata, organization_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entityType,
        entityId,
        userId || null,
        action,
        description,
        metadata ? JSON.stringify(metadata) : null,
        orgId || null,
      ]
    );
  } catch (err) {
    console.error('[activityLog] insert failed:', err.message);
  }
}

/**
 * Convenience wrapper for task-related events.
 * The `req` shortcut grabs user/org from a standard Express request.
 */
export async function logTaskActivity(req, taskId, action, { description, metadata, clientId } = {}) {
  await logActivity({
    entityType: 'task',
    entityId: taskId,
    action,
    description,
    metadata: clientId ? { ...(metadata || {}), client_id: clientId } : metadata,
    userId: req?.teamMember?.id || null,
    orgId: req?.orgId || null,
  });
}

/**
 * Diff two snapshots of a task and produce a list of activity log entries.
 * Used by tasks.js when handling PUT, to capture every meaningful change.
 *
 * @returns {Array<{action, description, metadata}>}
 */
export function diffTaskForActivity(oldTask, newTask, ctx = {}) {
  const events = [];
  const { assigneeNamesById = {}, projectNamesById = {} } = ctx;

  const labelStatus = (s) => ({
    todo: 'Por hacer',
    in_progress: 'En progreso',
    review: 'En revisión',
    done: 'Completada',
    blocked: 'Bloqueada',
  }[s] || s);

  const labelPriority = (p) => ({
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente',
  }[p] || p);

  // Status
  if (oldTask.status !== newTask.status) {
    events.push({
      action: 'status_changed',
      description: `Cambió estado: ${labelStatus(oldTask.status)} → ${labelStatus(newTask.status)}`,
      metadata: { from: oldTask.status, to: newTask.status },
    });
  }

  // Priority
  if (oldTask.priority !== newTask.priority) {
    events.push({
      action: 'priority_changed',
      description: `Cambió prioridad: ${labelPriority(oldTask.priority)} → ${labelPriority(newTask.priority)}`,
      metadata: { from: oldTask.priority, to: newTask.priority },
    });
  }

  // Due date
  if ((oldTask.due_date || null) !== (newTask.due_date || null)) {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-CO') : 'sin fecha';
    events.push({
      action: 'due_date_changed',
      description: `Fecha límite: ${fmt(oldTask.due_date)} → ${fmt(newTask.due_date)}`,
      metadata: { from: oldTask.due_date, to: newTask.due_date },
    });
  }

  // Title
  if ((oldTask.title || '') !== (newTask.title || '')) {
    events.push({
      action: 'title_changed',
      description: `Renombró: "${oldTask.title}" → "${newTask.title}"`,
      metadata: { from: oldTask.title, to: newTask.title },
    });
  }

  // Project
  if ((oldTask.project_id || null) !== (newTask.project_id || null)) {
    const fromName = projectNamesById[oldTask.project_id] || (oldTask.project_id ? `#${oldTask.project_id}` : 'ninguno');
    const toName = projectNamesById[newTask.project_id] || (newTask.project_id ? `#${newTask.project_id}` : 'ninguno');
    events.push({
      action: 'project_changed',
      description: `Movió a otro proyecto: ${fromName} → ${toName}`,
      metadata: { from: oldTask.project_id, to: newTask.project_id },
    });
  }

  // Visibility
  const oldVis = !!oldTask.visible_to_client;
  const newVis = !!newTask.visible_to_client;
  if (oldVis !== newVis) {
    events.push({
      action: 'visibility_changed',
      description: newVis ? 'Ahora visible para el cliente' : 'Ya no visible para el cliente',
      metadata: { from: oldVis, to: newVis },
    });
  }

  // Client approval flag
  const oldApp = !!oldTask.requires_client_approval;
  const newApp = !!newTask.requires_client_approval;
  if (oldApp !== newApp) {
    events.push({
      action: newApp ? 'approval_requested' : 'approval_disabled',
      description: newApp
        ? 'Solicita aprobación del cliente'
        : 'Ya no requiere aprobación del cliente',
      metadata: { from: oldApp, to: newApp },
    });
  }

  return events;
}

export default { logActivity, logTaskActivity, diffTaskForActivity };
