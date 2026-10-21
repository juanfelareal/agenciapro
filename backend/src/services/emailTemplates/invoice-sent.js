import { h1, p, eyebrow, button, keyValue, note, escapeHtml } from './_layout.js';

const money = (n, currency = 'COP') => {
  const num = Number(n);
  if (Number.isNaN(num)) return String(n ?? '');
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
  } catch {
    return `$${num.toLocaleString('es-CO')}`;
  }
};

/** Al cliente: la agencia le envía una factura. */
export default {
  subject: ({ org, invoiceNumber }) => `Factura ${invoiceNumber} de ${org.name}`,
  body: ({ org, brand, clientName, invoiceNumber, issueDate, dueDate, amount, currency, projectName, notes, invoiceUrl }) => `
    ${eyebrow('Factura')}
    ${h1(`Factura ${escapeHtml(invoiceNumber)}`)}
    ${p(`Hola ${escapeHtml(clientName || '')}, te compartimos la factura correspondiente a los servicios de <strong>${escapeHtml(org.name)}</strong>.`)}
    ${keyValue([
      ['Número', escapeHtml(invoiceNumber)],
      issueDate ? ['Fecha de emisión', escapeHtml(issueDate)] : null,
      dueDate ? ['Vence', escapeHtml(dueDate)] : null,
      projectName ? ['Proyecto', escapeHtml(projectName)] : null,
      ['Total', `<span style="font-size:20px;">${money(amount, currency)}</span>`],
    ].filter(Boolean))}
    ${notes ? p(`<strong>Notas:</strong> ${escapeHtml(notes)}`, { size: 14 }) : ''}
    ${invoiceUrl ? button(invoiceUrl, 'Ver factura', brand) : ''}
    ${note(`¿Dudas sobre esta factura? Responde a este correo y el equipo de ${escapeHtml(org.name)} te ayuda.`)}
  `,
  sample: {
    clientName: 'Café Sereno',
    invoiceNumber: 'FAC-0042',
    issueDate: '2026-10-20',
    dueDate: '2026-11-04',
    amount: 3500000,
    currency: 'COP',
    projectName: 'Pauta octubre',
    notes: 'Incluye gestión de pauta y 4 piezas creativas.',
    invoiceUrl: null,
  },
};
