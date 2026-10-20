import { h1, p, eyebrow, codeBox, note, escapeHtml } from './_layout.js';

/** Código de 6 dígitos para recuperar el PIN (vence en 15 minutos). */
export default {
  subject: () => 'Tu código para recuperar el PIN',
  body: ({ userName, code, expiresInMinutes = 15, resetUrl }) => `
    ${eyebrow('Recuperar acceso')}
    ${h1(`${escapeHtml(userName || 'Hola')}, aquí está tu código`)}
    ${p('Recibimos una solicitud para restablecer el PIN de tu cuenta en Orbit. Escribe este código en la pantalla de recuperación y luego define tu PIN nuevo.')}
    ${codeBox(code)}
    ${p(`El código vence en <strong>${expiresInMinutes} minutos</strong> y solo funciona una vez.`, { size: 14 })}
    ${resetUrl ? p(`¿Cerraste la pantalla? <a href="${escapeHtml(resetUrl)}" style="color:#121212;font-weight:600;">Vuelve a recuperar el PIN</a>.`, { size: 14 }) : ''}
    ${note('Si no pediste este cambio, no hagas nada: tu PIN actual sigue funcionando.')}
  `,
  sample: {
    userName: 'Camila Ríos',
    code: '482913',
    resetUrl: '{{APP_URL}}/recuperar-pin',
  },
};
