import html2pdf from 'html2pdf.js';

/**
 * Exportación de la bitácora de un cliente (CSV y PDF).
 * Todo el contenido se formatea en hora de Colombia; sin dependencias extra para CSV.
 */
const TZ = 'America/Bogota';

const partsOf = (date, opts) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour12: false, ...opts }).formatToParts(date);
  const g = (t) => parts.find(p => p.type === t)?.value;
  return { y: g('year'), m: g('month'), d: g('day'), h: g('hour') === '24' ? '00' : g('hour'), mi: g('minute') };
};

// "2026-10-06 14:30" — ordenable y legible en Excel
export const fmtSortable = (iso) => {
  if (!iso) return '';
  const { y, m, d, h, mi } = partsOf(new Date(iso), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${y}-${m}-${d} ${h}:${mi}`;
};
// "6 oct 2026, 2:30 p. m."
export const fmtHuman = (iso) => iso
  ? new Date(iso).toLocaleString('es-CO', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '';
// due_date es fecha calendario (YYYY-MM-DD): nunca se desplaza por zona horaria
export const fmtDueDate = (d) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '';

export const slugify = (s) => String(s || 'cliente')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'cliente';

const actionLine = (a) => {
  const parts = [`[${a.is_done ? 'x' : ' '}] ${a.description || ''}`];
  if (a.assignee_name) parts.push(a.assignee_name);
  if (a.due_date) parts.push(fmtDueDate(a.due_date));
  return parts.join(' · ');
};

const sortByEventDesc = (entries) => [...entries].sort((a, b) => new Date(b.event_at) - new Date(a.event_at));

// ─── CSV ───
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * @param {object} p
 * @param {Array} p.entries        entradas ya filtradas
 * @param {string} p.clientName
 * @param {string} p.fileSuffix    "2026-10" | "todo"
 * @param {object} p.labels        { typeLabel, platformLabel, impactLabel }
 */
export function exportLogbookCSV({ entries, clientName, fileSuffix, labels }) {
  const header = ['Fecha y hora del suceso', 'Tipo', 'Título', 'Descripción', 'Plataformas', 'Impacto', 'Link', 'Registró', 'Acciones'];
  const rows = sortByEventDesc(entries).map(e => [
    fmtSortable(e.event_at),
    labels.typeLabel(e.entry_type),
    e.title || '',
    e.description || '',
    (e.platforms || []).map(labels.platformLabel).join(', '),
    labels.impactLabel(e.impact),
    e.link_url || '',
    e.created_by_name || 'Equipo',
    (e.actions || []).map(actionLine).join(' | '),
  ]);
  const content = [header, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
  // BOM para que Excel abra bien los acentos
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `bitacora-${slugify(clientName)}-${fileSuffix}.csv`);
}

// ─── PDF ───
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nl2br = (s) => esc(s).replace(/\r?\n/g, '<br>');

const pdfStyles = `
  .lb-root { font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 12.5px; line-height: 1.5; }
  .lb-head { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 18px; }
  .lb-head h1 { font-size: 20px; margin: 0 0 4px; font-weight: 700; }
  .lb-head p { margin: 0; color: #4b5563; font-size: 12px; }
  .lb-entry { padding: 12px 0; border-bottom: 1px solid #e5e7eb; page-break-inside: avoid; break-inside: avoid; }
  .lb-meta { color: #6b7280; font-size: 11.5px; margin-bottom: 4px; }
  .lb-pill { display: inline-block; padding: 1px 8px; border-radius: 999px; background: #f3f4f6; color: #374151; font-size: 11px; margin-right: 6px; }
  .lb-title { font-size: 14px; font-weight: 700; margin: 2px 0 4px; }
  .lb-desc { margin: 0 0 6px; color: #1f2937; }
  .lb-row { color: #374151; font-size: 12px; margin: 2px 0; }
  .lb-row b { color: #111827; font-weight: 600; }
  .lb-link { color: #1d4ed8; word-break: break-all; }
  .lb-actions { margin: 6px 0 0; padding: 0; list-style: none; }
  .lb-actions li { margin: 2px 0; font-size: 12px; }
  .lb-done { color: #6b7280; text-decoration: line-through; }
  .lb-empty { color: #6b7280; font-style: italic; }
`;

const entryHtml = (e, labels) => {
  const platforms = (e.platforms || []).map(labels.platformLabel).join(', ');
  const impact = labels.impactLabel(e.impact);
  const actions = e.actions || [];
  return `
    <div class="lb-entry">
      <div class="lb-meta">${esc(fmtHuman(e.event_at))}${e.is_pinned ? ' · Fijada' : ''}</div>
      <div><span class="lb-pill">${esc(labels.typeLabel(e.entry_type))}</span>${impact ? `<span class="lb-pill">Impacto ${esc(impact.toLowerCase())}</span>` : ''}</div>
      <div class="lb-title">${esc(e.title)}</div>
      ${e.description ? `<p class="lb-desc">${nl2br(e.description)}</p>` : ''}
      ${platforms ? `<div class="lb-row"><b>Plataformas:</b> ${esc(platforms)}</div>` : ''}
      ${e.link_url ? `<div class="lb-row"><b>Link:</b> <span class="lb-link">${esc(e.link_url)}</span></div>` : ''}
      <div class="lb-row"><b>Registró:</b> ${esc(e.created_by_name || 'Equipo')}</div>
      <div class="lb-row"><b>Acciones</b>${actions.length ? ` (${actions.filter(a => a.is_done).length}/${actions.length} hechas)` : ''}:</div>
      ${actions.length
        ? `<ul class="lb-actions">${actions.map(a => `
            <li class="${a.is_done ? 'lb-done' : ''}">${a.is_done ? '☑' : '☐'} ${esc(a.description)}${a.assignee_name ? ` · ${esc(a.assignee_name)}` : ''}${a.due_date ? ` · ${esc(fmtDueDate(a.due_date))}` : ''}</li>`).join('')}
          </ul>`
        : '<div class="lb-empty">Sin acciones registradas</div>'}
    </div>`;
};

/**
 * @param {object} p
 * @param {Array} p.entries        entradas ya filtradas
 * @param {string} p.clientName
 * @param {string} p.periodLabel   "Octubre 2026" | "Todo el historial"
 * @param {string} p.fileSuffix
 * @param {object} p.labels
 */
export async function exportLogbookPDF({ entries, clientName, periodLabel, fileSuffix, labels }) {
  const list = sortByEventDesc(entries);
  const exportedAt = new Date().toLocaleString('es-CO', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Contenedor fuera de pantalla (no display:none, html2canvas necesita layout)
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;';
  host.innerHTML = `
    <div class="lb-root">
      <style>${pdfStyles}</style>
      <div class="lb-head">
        <h1>Bitácora · ${esc(clientName)}</h1>
        <p>${esc(periodLabel)} · ${list.length} ${list.length === 1 ? 'entrada' : 'entradas'} · Exportado el ${esc(exportedAt)}</p>
      </div>
      ${list.length ? list.map(e => entryHtml(e, labels)).join('') : '<p class="lb-empty">No hay entradas para este filtro.</p>'}
    </div>`;
  document.body.appendChild(host);

  try {
    await html2pdf()
      .set({
        margin: 12,
        filename: `bitacora-${slugify(clientName)}-${fileSuffix}.pdf`,
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(host.firstElementChild)
      .save();
  } finally {
    host.remove();
  }
}
