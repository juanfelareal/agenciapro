import { h1, p, eyebrow, button, keyValue, note, escapeHtml } from './_layout.js';

/** A un miembro del equipo: le asignaron una tarea (opcional, respeta preferencias). */
export default {
  subject: ({ taskTitle }) => `Te asignaron: ${taskTitle}`,
  body: ({ brand, memberName, assignedBy, taskTitle, projectName, clientName, dueDate, taskUrl }) => `
    ${eyebrow('Nueva tarea')}
    ${h1(`${escapeHtml(memberName || 'Hola')}, tienes una tarea nueva`)}
    ${p(`<strong>${escapeHtml(assignedBy || 'Alguien del equipo')}</strong> te asignó <strong>${escapeHtml(taskTitle)}</strong>.`)}
    ${keyValue([
      projectName ? ['Proyecto', escapeHtml(projectName)] : null,
      clientName ? ['Cliente', escapeHtml(clientName)] : null,
      dueDate ? ['Fecha límite', escapeHtml(dueDate)] : null,
    ].filter(Boolean))}
    ${button(taskUrl, 'Ver la tarea', brand)}
    ${note('Puedes desactivar estos avisos desde tus preferencias de notificaciones en Orbit.')}
  `,
  sample: {
    memberName: 'Camila Ríos',
    assignedBy: 'Juan Felipe León',
    taskTitle: 'Guion del reel de lanzamiento',
    projectName: 'Lanzamiento Q4',
    clientName: 'Café Sereno',
    dueDate: '24 de octubre',
    taskUrl: '{{APP_URL}}/app/tasks?task=123',
  },
};
