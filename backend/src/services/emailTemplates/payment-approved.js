import { h1, p, eyebrow, button, keyValue, note, escapeHtml, INK_SOFT } from './_layout.js';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";

/** Lista "Incluido al iniciar" con su valor (anual). Nunca la palabra "Regalo". */
const includesList = (items = []) => {
  if (!items.length) return '';
  const rows = items.map((i) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;line-height:1.4;color:${INK_SOFT};font-family:${FONT};">${escapeHtml(i.label)}</td>
      <td style="padding:6px 0;font-size:14px;line-height:1.4;color:${INK_SOFT};font-family:${FONT};text-align:right;white-space:nowrap;">${escapeHtml(i.value)}</td>
    </tr>`).join('');
  return `
    ${p('<strong>Incluido al iniciar</strong>', { size: 14 })}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;">${rows}</table>`;
};

/** A la agencia: su pago fue aprobado y el plan quedó activo. */
export default {
  subject: ({ planName, cycleLabel }) => `Pago confirmado: plan ${planName} ${String(cycleLabel || '').toLowerCase()} activo en Orbit`,
  body: ({ org, brand, planName, cycleLabel, amount, iva, total, reference, paymentMethod, renewsAt, priceLockedUntil, includes, appUrl }) => `
    ${eyebrow('Suscripción')}
    ${h1(`Tu plan ${escapeHtml(planName)} ya está activo`)}
    ${p(`Recibimos el pago de <strong>${escapeHtml(org.name)}</strong>. Desde ahora ${escapeHtml(org.name)} trabaja en Orbit con el plan ${escapeHtml(planName)} (${escapeHtml(String(cycleLabel || '').toLowerCase())}).`)}
    ${keyValue([
      ['Plan', `${escapeHtml(planName)} · ${escapeHtml(cycleLabel)}`],
      ['Valor', `${escapeHtml(amount)} + IVA ${escapeHtml(iva)}`],
      ['Total pagado', `<span style="font-size:20px;">${escapeHtml(total)}</span>`],
      paymentMethod ? ['Medio de pago', escapeHtml(paymentMethod)] : null,
      ['Referencia', escapeHtml(reference)],
      renewsAt ? ['Próxima renovación', escapeHtml(renewsAt)] : null,
      priceLockedUntil ? ['Precio congelado hasta', escapeHtml(priceLockedUntil)] : null,
    ].filter(Boolean))}
    ${includesList(includes)}
    ${button(appUrl, 'Ver mi suscripción', brand)}
    ${note('Si necesitas la factura electrónica o cambiar algo de tu plan, responde a este correo y te ayudamos.')}
  `,
  sample: {
    planName: 'Growth',
    cycleLabel: 'Anual',
    amount: '$4.890.000',
    iva: '$929.100',
    total: '$5.819.100',
    reference: 'orb_12_1760990000000_a1b2c3',
    paymentMethod: 'PSE',
    renewsAt: '20 de octubre de 2027',
    priceLockedUntil: '20 de octubre de 2028',
    includes: [
      { label: 'Implementación acompañada', value: '$1.200.000' },
      { label: 'Reportes cada hora por WhatsApp (12 meses)', value: '$708.000' },
      { label: 'Reporte diario al dueño hasta en 10 marcas (12 meses)', value: '$2.280.000' },
      { label: 'Sesión de números con Juanfe (90 min)', value: '$800.000' },
    ],
    appUrl: '{{APP_URL}}/app/suscripcion',
  },
};
