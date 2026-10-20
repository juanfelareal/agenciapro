import { h1, p, eyebrow, button, keyValue, note, escapeHtml } from './_layout.js';

const fmtDate = (d) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
};

/** A los admins de la agencia: la prueba termina en ~3 días. */
export default {
  subject: ({ org, daysLeft = 3 }) => `Tu prueba de Orbit termina en ${daysLeft} días (${org.name})`,
  body: ({ org, brand, adminName, trialEndsAt, daysLeft = 3, billingUrl }) => `
    ${eyebrow('Tu prueba está por terminar')}
    ${h1(`${escapeHtml(adminName || 'Hola')}, quedan ${daysLeft} días de prueba`)}
    ${p(`El periodo de prueba de <strong>${escapeHtml(org.name)}</strong> en Orbit termina el <strong>${fmtDate(trialEndsAt)}</strong>. Nada se borra: tus clientes, proyectos y datos siguen ahí, pero el acceso del equipo se pausa hasta que elijas un plan.`)}
    ${keyValue([
      ['Organización', escapeHtml(org.name)],
      ['Fin de la prueba', fmtDate(trialEndsAt)],
    ])}
    ${button(billingUrl, 'Elegir un plan', brand)}
    ${p('Si tienes dudas sobre qué plan te conviene, responde a este correo y te ayudamos.', { size: 14 })}
    ${note('Este aviso se envía una sola vez a los administradores de la organización.')}
  `,
  sample: {
    adminName: 'Juan Felipe',
    trialEndsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    daysLeft: 3,
    billingUrl: '{{APP_URL}}/app/settings',
  },
};
