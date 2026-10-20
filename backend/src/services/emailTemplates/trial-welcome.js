import { h1, p, eyebrow, button, steps, note, escapeHtml } from './_layout.js';

/** A la agencia recién registrada: qué hacer primero. */
export default {
  subject: ({ org }) => `Bienvenido a Orbit, ${org.name}`,
  body: ({ org, brand, adminName, appUrl, trialDays }) => `
    ${eyebrow('Primeros pasos')}
    ${h1(`${escapeHtml(adminName || 'Hola')}, ${escapeHtml(org.name)} ya está en Orbit`)}
    ${p('Creaste el espacio de tu agencia. Lo que sigue toma unos minutos y deja a Orbit listo para trabajar con tu equipo y tus clientes.')}
    ${steps([
      { title: 'Pon tu marca', body: `Sube el logo y elige el color de acento en <em>Configuración</em>. Tus correos y el portal de clientes salen con la marca de ${escapeHtml(org.name)}, no con la nuestra.` },
      { title: 'Invita a tu equipo', body: 'En <em>Equipo</em> agrega a cada persona con su correo. Reciben un enlace para definir su PIN; no tienes que repartir claves.' },
      { title: 'Crea tu primer cliente y su portal', body: 'Desde <em>Clientes</em> crea la cuenta, genera la invitación al portal y envíasela por correo con un clic.' },
      { title: 'Conecta las fuentes de datos', body: 'Meta Ads, Shopify, Google Ads: en <em>Plataformas</em> de cada cliente para que las métricas lleguen solas.' },
    ])}
    ${button(appUrl, 'Entrar a Orbit', brand)}
    ${trialDays ? note(`Tienes ${trialDays} días de prueba con todo incluido. Te avisaremos unos días antes de que termine.`) : ''}
  `,
  sample: {
    adminName: 'Juan Felipe',
    appUrl: '{{APP_URL}}/app',
    trialDays: 14,
  },
};
