import db from '../config/database.js';

// Tareas recurrentes (estilo ClickUp): al completar una tarea recurrente se crea
// la siguiente ocurrencia en 'todo' y la recurrencia pasa a la copia.
// recurrence_pattern = { type: 'weekly', days: [0..6] } con 0 = domingo (getDay de JS).

const DAY_MS = 24 * 60 * 60 * 1000;

const todayInBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// 'YYYY-MM-DD' (o ISO con hora) -> Date en UTC a medianoche; null si no es válida
const parseDay = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDay = (d) => d.toISOString().slice(0, 10);

const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);

/**
 * Normaliza recurrence_pattern a objeto. Acepta objeto o texto JSON (incluso
 * doblemente serializado, como lo mandaban algunas vistas). Devuelve null si
 * viene vacío.
 */
export function parseRecurrencePattern(pattern) {
  let value = pattern;
  for (let i = 0; i < 20 && typeof value === 'string'; i++) {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/**
 * Valida recurrence_pattern. Devuelve el patrón normalizado ({ type, days })
 * o lanza un Error con status 400 si no es válido. null/undefined pasan tal cual.
 */
export function validateRecurrencePattern(pattern) {
  if (pattern === undefined || pattern === null || pattern === '') return pattern === '' ? null : pattern;
  const parsed = parseRecurrencePattern(pattern);
  const fail = (msg) => {
    const err = new Error(msg);
    err.status = 400;
    throw err;
  };
  if (!parsed) fail('El patrón de recurrencia no es válido');
  const type = parsed.type || 'weekly';
  if (type !== 'weekly') fail('Solo se admite recurrencia semanal');
  const days = parsed.days ?? [];
  if (!Array.isArray(days) || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    fail('Los días de la recurrencia deben ser números del 0 (domingo) al 6 (sábado)');
  }
  return { ...parsed, type, days: [...new Set(days)].sort((a, b) => a - b) };
}

/**
 * Próxima fecha ('YYYY-MM-DD') estrictamente después de max(fecha de vencimiento, hoy en Bogotá)
 * que cae en uno de los días elegidos. Sin días: el día de la semana de la fecha de
 * vencimiento; sin días ni fecha: +7 días desde hoy.
 */
export function nextOccurrenceDate(pattern, dueDate, today = todayInBogota()) {
  const todayDay = parseDay(today);
  const due = parseDay(dueDate);
  const base = due && due > todayDay ? due : todayDay;

  let days = (parseRecurrencePattern(pattern)?.days || []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (days.length === 0) {
    if (!due) return formatDay(addDays(todayDay, 7));
    days = [due.getUTCDay()];
  }

  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(base, i);
    if (days.includes(candidate.getUTCDay())) return formatDay(candidate);
  }
  return formatDay(addDays(base, 7));
}

/**
 * Crea la siguiente ocurrencia de una tarea recurrente recién completada.
 * Copia responsables, etiquetas y subtareas (sin marcar) dentro de la misma
 * organización y deja la original con is_recurring = 0. Devuelve la tarea nueva
 * (con assignee_ids) o null si no correspondía crearla (ya no es recurrente o la
 * serie ya tiene su siguiente ocurrencia).
 */
export async function createNextOccurrence(task, orgId, actorId = null) {
  let created = null;

  await db.transaction(async (client) => {
    // Bloquea la fila y confirma que sigue siendo recurrente dentro de la org
    const { rows: [current] } = await client.query(
      'SELECT * FROM tasks WHERE id = $1 AND organization_id = $2 AND is_recurring = 1 FOR UPDATE',
      [task.id, orgId]
    );
    if (!current) return;

    // La recurrencia se mueve a la copia: la completada deja de ser recurrente
    await client.query(
      'UPDATE tasks SET is_recurring = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2',
      [current.id, orgId]
    );

    // Si ya se generó la siguiente (p. ej. se reabrió y se volvió a completar), no duplicar
    const { rows: [existing] } = await client.query(
      'SELECT id FROM tasks WHERE recurrence_parent_id = $1 AND organization_id = $2 LIMIT 1',
      [current.id, orgId]
    );
    if (existing) return;

    const pattern = parseRecurrencePattern(current.recurrence_pattern) || { type: 'weekly', days: [] };
    const newDue = nextOccurrenceDate(pattern, current.due_date);

    // El cronograma se desplaza los mismos días que la fecha de vencimiento
    let timelineStart = null;
    let timelineEnd = null;
    const anchor = parseDay(current.due_date) || parseDay(current.timeline_end) || parseDay(current.timeline_start);
    if (anchor && (current.timeline_start || current.timeline_end)) {
      const shift = Math.round((parseDay(newDue).getTime() - anchor.getTime()) / DAY_MS);
      const start = parseDay(current.timeline_start);
      const end = parseDay(current.timeline_end);
      timelineStart = start ? formatDay(addDays(start, shift)) : null;
      timelineEnd = end ? formatDay(addDays(end, shift)) : null;
    }

    const { rows: [inserted] } = await client.query(
      `INSERT INTO tasks (
         title, description, project_id, assigned_to, status, priority, due_date,
         is_recurring, recurrence_pattern, recurrence_parent_id, parent_task_id,
         timeline_start, timeline_end, progress, color, estimated_hours, created_by,
         visible_to_client, requires_client_approval, client_approval_status, is_private, organization_id
       )
       VALUES ($1, $2, $3, $4, 'todo', $5, $6, 1, $7, $8, $9, $10, $11, 0, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        current.title,
        current.description,
        current.project_id,
        current.assigned_to,
        current.priority || 'medium',
        newDue,
        JSON.stringify(pattern),
        current.id,
        current.parent_task_id,
        timelineStart,
        timelineEnd,
        current.color,
        current.estimated_hours,
        actorId || current.created_by,
        current.visible_to_client ? 1 : 0,
        current.requires_client_approval ? 1 : 0,
        current.requires_client_approval ? 'pending' : null,
        current.is_private ? 1 : 0,
        orgId,
      ]
    );

    // Responsables (solo miembros de la misma organización)
    const { rows: assignees } = await client.query(
      `INSERT INTO task_assignees (task_id, team_member_id, organization_id)
       SELECT $1, ta.team_member_id, $2
         FROM task_assignees ta
         JOIN team_members tm ON tm.id = ta.team_member_id AND tm.organization_id = $2
        WHERE ta.task_id = $3
       ON CONFLICT (task_id, team_member_id) DO NOTHING
       RETURNING team_member_id`,
      [inserted.id, orgId, current.id]
    );

    // Etiquetas (solo las de la misma organización)
    await client.query(
      `INSERT INTO task_tags (task_id, tag_id)
       SELECT $1, tt.tag_id
         FROM task_tags tt
         JOIN tags t ON t.id = tt.tag_id AND t.organization_id = $2
        WHERE tt.task_id = $3
       ON CONFLICT (task_id, tag_id) DO NOTHING`,
      [inserted.id, orgId, current.id]
    );

    // Subtareas, sin marcar
    await client.query(
      `INSERT INTO subtasks (task_id, title, is_completed, position, organization_id)
       SELECT $1, s.title, 0, s.position, $2
         FROM subtasks s
        WHERE s.task_id = $3
        ORDER BY s.position, s.id`,
      [inserted.id, orgId, current.id]
    );

    created = { ...inserted, assignee_ids: assignees.map((a) => a.team_member_id) };
  });

  return created;
}
