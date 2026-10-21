import { h1, p, eyebrow, button, keyValue, steps, note, escapeHtml } from './_layout.js';

/** Al cliente: la agencia le dio acceso a su portal. */
export default {
  subject: ({ org }) => `${org.name} te dio acceso a tu portal`,
  body: ({ org, brand, clientName, contactName, portalUrl, inviteCode }) => `
    ${eyebrow('Tu portal de cliente')}
    ${h1(`${escapeHtml(contactName || clientName || 'Hola')}, ${escapeHtml(org.name)} te dio acceso a tu portal`)}
    ${p(`Desde hoy puedes ver el avance de <strong>${escapeHtml(clientName || 'tu cuenta')}</strong> en un solo lugar: proyectos, tareas, reportes, facturas y documentos, actualizados por el equipo de ${escapeHtml(org.name)}.`)}
    ${button(portalUrl, 'Entrar a mi portal', brand)}
    ${inviteCode ? keyValue([['Código de acceso', `<span style="letter-spacing:2px;">${escapeHtml(inviteCode)}</span>`]]) : ''}
    ${steps([
      { title: 'Abre el enlace', body: 'El código ya viene incluido; si te lo piden, cópialo de arriba.' },
      { title: 'Guarda el acceso', body: 'Puedes volver cuando quieras desde el mismo enlace.' },
      { title: 'Revisa y comenta', body: 'Aprueba entregables y deja comentarios directamente en cada tarea.' },
    ])}
    ${note(`Este acceso es personal para ${escapeHtml(clientName || 'tu empresa')}. Si no esperabas este correo, escríbele a tu contacto en ${escapeHtml(org.name)}.`)}
  `,
  sample: {
    clientName: 'Café Sereno',
    contactName: 'Laura',
    inviteCode: 'ABCD-2345',
    portalUrl: '{{APP_URL}}/portal/login?code=ABCD-2345',
  },
};
