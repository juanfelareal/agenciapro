import { h1, p, eyebrow, button, keyValue, note, escapeHtml } from './_layout.js';

/**
 * Bienvenida al equipo. Dos modos:
 *  - data.inviteUrl → enlace para definir el PIN (invitación por enlace, 7 días)
 *  - data.pin       → PIN temporal definido por el admin (flujo manual)
 */
export default {
  subject: ({ org }) => `Te invitaron al equipo de ${org.name} en Orbit`,
  body: ({ org, brand, memberName, email, inviteUrl, pin, loginUrl, invitedBy, expiresInDays = 7 }) => {
    const name = escapeHtml(memberName || 'Hola');
    const who = invitedBy ? `<strong>${escapeHtml(invitedBy)}</strong> te invitó` : 'Te invitaron';
    const intro = `${who} a trabajar en <strong>${escapeHtml(org.name)}</strong> desde Orbit: el espacio donde el equipo lleva clientes, proyectos, tareas y números en un solo lugar.`;

    if (inviteUrl) {
      return `
        ${eyebrow('Invitación al equipo')}
        ${h1(`${name}, ya tienes un lugar en ${escapeHtml(org.name)}`)}
        ${p(intro)}
        ${p('Para entrar solo falta que definas tu PIN de acceso. Toma menos de un minuto.')}
        ${button(inviteUrl, 'Definir mi PIN y entrar', brand)}
        ${keyValue([['Tu correo de acceso', escapeHtml(email || '')]])}
        ${note(`Este enlace vence en ${expiresInDays} días y solo se puede usar una vez. Si venció, pide a un administrador que te reenvíe la invitación.`)}
      `;
    }

    return `
      ${eyebrow('Invitación al equipo')}
      ${h1(`${name}, ya tienes un lugar en ${escapeHtml(org.name)}`)}
      ${p(intro)}
      ${p('Estas son tus credenciales para entrar. Te recomendamos cambiar el PIN desde Configuración la primera vez.')}
      ${keyValue([
        ['Correo', escapeHtml(email || '')],
        ['PIN temporal', `<span style="letter-spacing:3px;font-size:18px;">${escapeHtml(pin || '')}</span>`],
      ])}
      ${button(loginUrl, 'Iniciar sesión', brand)}
      ${note('Si no reconoces esta invitación, ignora este correo.')}
    `;
  },
  sample: {
    memberName: 'Camila Ríos',
    email: 'camila@tuagencia.com',
    invitedBy: 'Juan Felipe León',
    inviteUrl: '{{APP_URL}}/invitacion/EJEMPLO-TOKEN',
    loginUrl: '{{APP_URL}}/login',
  },
};
