import express from 'express';
import db from '../config/database.js';
import { sendEmail } from '../utils/emailHelper.js';
import { generatePdfToken } from './invoice-pdf.js';
import { startSyncJob, getSyncJob } from '../services/siigoAutoSync.js';
import { isKapsoConfigured, getApprovedTemplate, normalizeWaNumber, formatWaNumber } from '../utils/kapsoClient.js';
import { sendTextAndRecord, sendTemplateAndRecord } from '../services/whatsappService.js';

const router = express.Router();

// Copia obligatoria en todos los correos de cobro (configurable con COLLECTIONS_CC, separado por comas)
export const COLLECTIONS_CC = (process.env.COLLECTIONS_CC || 'juanfe@larealmarketing.com').split(',').map((e) => e.trim()).filter(Boolean);
export const toList = (v) => String(v || '').split(',').map((e) => e.trim()).filter((e) => e.includes('@'));

// ========================================
// COLLECTIONS / CARTERA MODULE
// ========================================

// Helper: build email HTML for a collection reminder
async function buildReminderEmail({ client_id, custom_message, closing_message, invoice_ids, orgId }) {
  const client = await db.get(`
    SELECT id, name, company, email, nit
    FROM clients WHERE id = ? AND organization_id = ?
  `, [client_id, orgId]);

  if (!client) throw new Error('Cliente no encontrado');

  const clientDisplayName = client.company || client.name;

  let invoiceQuery = `
    SELECT i.*, p.name as project_name
    FROM invoices i
    LEFT JOIN projects p ON i.project_id = p.id
    WHERE i.client_id = ?
      AND i.status IN ('approved', 'invoiced')
      AND i.organization_id = ?
  `;
  const invoiceParams = [client_id, orgId];

  if (invoice_ids && invoice_ids.length > 0) {
    const placeholders = invoice_ids.map(() => '?').join(',');
    invoiceQuery += ` AND i.id IN (${placeholders})`;
    invoiceParams.push(...invoice_ids);
  }

  invoiceQuery += ' ORDER BY i.issue_date ASC';
  const invoices = await db.all(invoiceQuery, invoiceParams);

  if (invoices.length === 0) throw new Error('No hay facturas pendientes para este cliente');

  const totalOwed = invoices.reduce((sum, inv) => sum + Number(inv.siigo_balance ?? inv.amount), 0);

  const org = await db.get(`SELECT name, logo_url FROM organizations WHERE id = ?`, [orgId]);
  const orgName = org?.name || 'La Agencia';
  const backendUrl = process.env.BACKEND_URL || 'https://agenciapro-production.up.railway.app';

  const invoiceRows = invoices.map((inv) => {
    const isOverdue = inv.due_date && inv.due_date < new Date().toISOString().split('T')[0];
    const statusColor = isOverdue ? '#DC2626' : '#F59E0B';
    const statusText = isOverdue ? 'Vencida' : 'Pendiente';
    const daysAgo = inv.issue_date
      ? Math.floor((new Date() - new Date(inv.issue_date + 'T00:00:00')) / (1000 * 60 * 60 * 24))
      : 0;
    const daysText = daysAgo === 0 ? 'Hoy' : daysAgo === 1 ? '1 día' : `${daysAgo} días`;
    const invoiceCell = inv.siigo_id
      ? `<a href="${backendUrl}/api/invoice-pdf/${generatePdfToken(inv.id, orgId)}" style="color: #2563EB; text-decoration: underline; font-weight: 600;">${inv.invoice_number}</a>`
      : `<span style="font-weight: 600; color: #374151;">${inv.invoice_number}</span>`;
    return `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 14px 16px; font-size: 14px;">${invoiceCell}</td>
        <td style="padding: 14px 16px; font-size: 14px; color: #374151;">${inv.issue_date}</td>
        <td style="padding: 14px 16px; font-size: 14px; color: ${daysAgo > 30 ? '#DC2626' : daysAgo > 15 ? '#F59E0B' : '#374151'}; font-weight: ${daysAgo > 15 ? '600' : '400'};">${daysText}</td>
        <td style="padding: 14px 16px; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">$${Number(inv.siigo_balance ?? inv.amount).toLocaleString('es-CO')}</td>
        <td style="padding: 14px 16px; text-align: center;">
          <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; color: white; background-color: ${statusColor};">${statusText}</span>
        </td>
      </tr>
    `;
  }).join('');

  const today = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  const defaultMessage = `Esperamos que se encuentren bien. Les enviamos el estado de cuenta actualizado de ${clientDisplayName} con ${orgName}. Les pedimos el favor nos envíen el comprobante de pago de cada una de estas facturas para poderlo relacionar en nuestra contabilidad.`;
  const messageBody = custom_message || defaultMessage;

  const defaultClosing = `Si ya realizaron el pago, por favor envíennos el comprobante para actualizar su estado de cuenta. Quedamos atentos a cualquier inquietud.`;
  const closingBody = closing_message || defaultClosing;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

              <!-- Header -->
              <tr>
                <td style="background-color: #1A1A2E; padding: 32px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <h1 style="color: #BFFF00; margin: 0; font-size: 22px; font-weight: 700;">${orgName}</h1>
                        <p style="color: rgba(255,255,255,0.7); margin: 6px 0 0; font-size: 13px;">Estado de Cuenta</p>
                      </td>
                      <td style="text-align: right;">
                        <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 13px;">${today}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Client Info -->
              <tr>
                <td style="padding: 32px 40px 16px;">
                  <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px;">Cliente</p>
                  <h2 style="color: #111827; margin: 0; font-size: 20px; font-weight: 700;">${clientDisplayName}</h2>
                  ${client.nit ? `<p style="color: #6B7280; margin: 4px 0 0; font-size: 14px;">NIT: ${client.nit}</p>` : ''}
                </td>
              </tr>

              <!-- Message -->
              <tr>
                <td style="padding: 8px 40px 24px;">
                  <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0;">${messageBody}</p>
                </td>
              </tr>

              <!-- Total Highlight -->
              <tr>
                <td style="padding: 0 40px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1A1A2E 0%, #2D2D4E 100%); border-radius: 12px;">
                    <tr>
                      <td style="padding: 24px 28px;">
                        <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px;">Saldo Total Pendiente</p>
                        <p style="color: #BFFF00; font-size: 32px; font-weight: 800; margin: 0;">$${totalOwed.toLocaleString('es-CO')}</p>
                        <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 6px 0 0;">${invoices.length} factura${invoices.length > 1 ? 's' : ''} pendiente${invoices.length > 1 ? 's' : ''}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Invoices Table -->
              <tr>
                <td style="padding: 0 40px 32px;">
                  <p style="color: #111827; font-size: 16px; font-weight: 700; margin: 0 0 12px;">Detalle de Facturas</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E5E7EB; border-radius: 10px; overflow: hidden;">
                    <tr style="background-color: #F9FAFB;">
                      <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Factura</th>
                      <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Emisión</th>
                      <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Emitida hace</th>
                      <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Monto</th>
                      <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Estado</th>
                    </tr>
                    ${invoiceRows}
                    <tr style="background-color: #F9FAFB;">
                      <td colspan="3" style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #111827;">TOTAL</td>
                      <td style="padding: 14px 16px; font-size: 16px; font-weight: 800; color: #111827; text-align: right;">$${totalOwed.toLocaleString('es-CO')}</td>
                      <td></td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td style="padding: 0 40px 24px;">
                  <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
                    ${closingBody}
                  </p>
                </td>
              </tr>

              <!-- Bank Info -->
              <tr>
                <td style="padding: 0 40px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px;">
                    <tr>
                      <td style="padding: 20px 24px;">
                        <p style="color: #111827; font-size: 14px; font-weight: 700; margin: 0 0 12px;">Datos para pago</p>
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 3px 0; color: #6B7280; font-size: 13px; width: 120px;">Banco:</td>
                            <td style="padding: 3px 0; color: #111827; font-size: 13px; font-weight: 600;">Bancolombia</td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #6B7280; font-size: 13px;">Tipo de cuenta:</td>
                            <td style="padding: 3px 0; color: #111827; font-size: 13px; font-weight: 600;">Ahorros</td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #6B7280; font-size: 13px;">No. de cuenta:</td>
                            <td style="padding: 3px 0; color: #111827; font-size: 13px; font-weight: 600;">862-000036-61</td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #6B7280; font-size: 13px;">Titular:</td>
                            <td style="padding: 3px 0; color: #111827; font-size: 13px; font-weight: 600;">LA REAL MARKETING SAS</td>
                          </tr>
                          <tr>
                            <td style="padding: 3px 0; color: #6B7280; font-size: 13px;">NIT:</td>
                            <td style="padding: 3px 0; color: #111827; font-size: 13px; font-weight: 600;">901.846.009</td>
                          </tr>
                        </table>
                        <p style="color: #DC2626; font-size: 12px; margin: 14px 0 0; line-height: 1.5;">
                          <strong>Importante:</strong> Los pagos se reciben únicamente en las cuentas oficiales de la empresa. No realice transferencias a cuentas diferentes a la indicada.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; border-top: 1px solid #E5E7EB; background-color: #F9FAFB;">
                  <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0;">Estefania Hernandez</p>
                  <p style="color: #6B7280; font-size: 13px; margin: 4px 0 0;">Administración y Cartera</p>
                  <p style="color: #6B7280; font-size: 13px; margin: 2px 0 0;">${orgName}</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return { html, messageBody, clientDisplayName, orgName, totalOwed, invoiceCount: invoices.length };
}

// ---------- Helpers de antigüedad / fechas ----------
const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'];
const COLLECTION_STATUSES = ['pending', 'contacted', 'promised', 'disputed'];
const CLIENT_NAME_SQL = `CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END`;
// issue_date/due_date son TEXT 'YYYY-MM-DD'; promise_date es DATE (se devuelve siempre como ::text para evitar desfases de zona horaria)
const DAYS_OUTSTANDING_SQL = `(CURRENT_DATE - NULLIF(i.issue_date, '')::date)`;
const TARGET_DATE_SQL = `COALESCE(i.promise_date::text, NULLIF(i.due_date, ''))`;

function agingBucket(days) {
  if (days === null || days === undefined || Number.isNaN(Number(days))) return null;
  const d = Number(days);
  if (d <= 30) return '0-30';
  if (d <= 60) return '31-60';
  if (d <= 90) return '61-90';
  return '90+';
}

const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function pdfUrlFor(inv, orgId) {
  if (!inv.siigo_id) return null;
  const backendUrl = process.env.BACKEND_URL || 'https://agenciapro-production.up.railway.app';
  return `${backendUrl}/api/invoice-pdf/${generatePdfToken(inv.id, orgId)}`;
}

// Totales de lo pendiente por bucket de antigüedad (días desde emisión)
async function getAgingTotals(orgId) {
  const rows = await db.all(`
    SELECT
      CASE WHEN d <= 30 THEN '0-30' WHEN d <= 60 THEN '31-60' WHEN d <= 90 THEN '61-90' ELSE '90+' END as bucket,
      COUNT(*)::int as count,
      COALESCE(SUM(amount), 0) as amount
    FROM (
      SELECT COALESCE(i.siigo_balance, i.amount) AS amount, ${DAYS_OUTSTANDING_SQL} as d
      FROM invoices i
      WHERE i.status IN ('approved', 'invoiced') AND i.organization_id = ?
    ) t
    GROUP BY 1
  `, [orgId]);
  const aging = {};
  for (const b of AGING_BUCKETS) aging[b] = { count: 0, amount: 0 };
  for (const r of rows) aging[r.bucket] = { count: Number(r.count), amount: Number(r.amount) };
  return aging;
}

// Get collections summary (dashboard data)
router.get('/summary', async (req, res) => {
  try {
    // Nota: el último recordatorio va en subconsulta para no multiplicar COUNT/SUM por cada correo enviado
    const overdue = await db.all(`
      SELECT
        c.id as client_id,
        ${CLIENT_NAME_SQL} as client_name,
        COALESCE(NULLIF(c.siigo_email, ''), c.email) as client_email, c.email as orbit_email, c.siigo_email,
        c.phone as client_phone,
        COUNT(i.id)::int as invoice_count,
        SUM(COALESCE(i.siigo_balance, i.amount)) as total_owed,
        MIN(i.issue_date) as oldest_invoice_date,
        MIN(NULLIF(i.due_date, '')) as oldest_due_date,
        MAX(${DAYS_OUTSTANDING_SQL})::int as oldest_days,
        COALESCE(
          MIN(i.promise_date) FILTER (WHERE i.promise_date >= CURRENT_DATE),
          MAX(i.promise_date)
        )::text as promise_date,
        mode() WITHIN GROUP (ORDER BY COALESCE(i.collection_status, 'pending')) as collection_status,
        (SELECT MAX(cr.sent_at) FROM collection_reminders cr WHERE cr.client_id = c.id AND cr.organization_id = ?) as last_reminder_sent
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.status IN ('approved', 'invoiced')
        AND i.organization_id = ?
      GROUP BY c.id, c.company, c.name, c.email, c.siigo_email, c.phone
      ORDER BY total_owed DESC
    `, [req.orgId, req.orgId]);

    for (const row of overdue) row.aging_bucket = agingBucket(row.oldest_days);

    const stats = await db.get(`
      SELECT
        COUNT(*)::int as total_invoices,
        COALESCE(SUM(COALESCE(i.siigo_balance, i.amount)), 0) as total_amount,
        COUNT(CASE WHEN NULLIF(i.due_date, '') IS NOT NULL AND i.due_date < CURRENT_DATE::text THEN 1 END)::int as overdue_count,
        COALESCE(SUM(CASE WHEN NULLIF(i.due_date, '') IS NOT NULL AND i.due_date < CURRENT_DATE::text THEN COALESCE(i.siigo_balance, i.amount) ELSE 0 END), 0) as overdue_amount,
        COALESCE(SUM(CASE WHEN LEFT(${TARGET_DATE_SQL}, 7) = to_char(CURRENT_DATE, 'YYYY-MM') THEN COALESCE(i.siigo_balance, i.amount) ELSE 0 END), 0) as expected_this_month,
        COUNT(CASE WHEN LEFT(${TARGET_DATE_SQL}, 7) = to_char(CURRENT_DATE, 'YYYY-MM') THEN 1 END)::int as expected_this_month_count
      FROM invoices i
      WHERE i.status IN ('approved', 'invoiced')
        AND i.organization_id = ?
    `, [req.orgId]);

    stats.aging = await getAgingTotals(req.orgId);

    const recentlyPaid = await db.all(`
      SELECT
        i.id, i.invoice_number, i.amount, i.paid_date,
        CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END as client_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.status = 'paid'
        AND i.paid_date >= (CURRENT_DATE - INTERVAL '30 days')::text
        AND i.organization_id = ?
      ORDER BY i.paid_date DESC
      LIMIT 10
    `, [req.orgId]);

    res.json({ clients: overdue, stats, recentlyPaid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sincronizar con Siigo desde Cartera: importa facturas nuevas (30 días) y marca pagadas las que ya tienen saldo 0.
// ?dry_run=1 solo cuenta qué pasaría, sin escribir.
router.post('/sync-siigo', async (req, res) => {
  try {
    const settings = await db.get('SELECT id FROM siigo_settings WHERE organization_id = ? AND is_active = 1', [req.orgId]);
    if (!settings) return res.status(400).json({ error: 'Siigo no está configurado para esta organización' });
    const dryRun = req.query.dry_run === '1' || req.body?.dry_run === true;
    const days = Math.min(parseInt(req.body?.days) || 30, 180);
    // Corre en segundo plano (Siigo limita ~100 consultas/min y la cartera puede tener cientos de facturas)
    const job = startSyncJob(req.orgId, { days, dryRun });
    res.json({ status: job.status, started_at: job.startedAt, progress: job.progress, message: 'Sincronización con Siigo en curso' });
  } catch (error) {
    console.error('Error sincronizando Siigo desde Cartera:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estado del job de sincronización con Siigo
router.get('/sync-siigo/status', async (req, res) => {
  const job = getSyncJob(req.orgId);
  if (!job) return res.json({ status: 'idle' });
  const r = job.result;
  const message = job.status === 'done'
    ? (job.dryRun
      ? `Simulación: ${r.marked_paid} facturas se marcarían como pagadas (${r.still_open} siguen abiertas en Siigo)`
      : `Siigo sincronizado: ${r.imported + (r.imported_open || 0)} facturas nuevas, ${r.marked_paid} marcadas como pagadas, ${r.still_open} siguen pendientes${r.not_in_siigo?.length ? `, ${r.not_in_siigo.length} abiertas en Orbit que no aparecen en Siigo` : ''}`)
    : job.status === 'failed' ? `Falló la sincronización: ${job.error}` : 'Sincronización con Siigo en curso';
  res.json({ status: job.status, dry_run: job.dryRun, started_at: job.startedAt, finished_at: job.finishedAt, progress: job.progress, result: r, error: job.error, message });
});

// Lista de facturas de cartera (vista "Por factura")
// ?status=open|paid|all (default open) &client_id= &from=YYYY-MM-DD &to=YYYY-MM-DD &search=
router.get('/invoices', async (req, res) => {
  try {
    const { status = 'open', client_id, from, to, search } = req.query;

    let where = 'WHERE i.organization_id = ?';
    const params = [req.orgId];

    if (status === 'paid') where += ` AND i.status = 'paid'`;
    else if (status === 'all') where += ` AND i.status IN ('approved', 'invoiced', 'paid')`;
    else where += ` AND i.status IN ('approved', 'invoiced')`;

    if (client_id) { where += ' AND i.client_id = ?'; params.push(client_id); }
    if (isDateStr(from)) { where += ' AND i.issue_date >= ?'; params.push(from); }
    if (isDateStr(to)) { where += ' AND i.issue_date <= ?'; params.push(to); }
    if (search && search.trim()) {
      where += ' AND (i.invoice_number ILIKE ? OR c.name ILIKE ? OR c.company ILIKE ?)';
      const like = `%${search.trim()}%`;
      params.push(like, like, like);
    }

    const rows = await db.all(`
      SELECT
        i.id, i.invoice_number, i.client_id,
        ${CLIENT_NAME_SQL} as client_name,
        COALESCE(NULLIF(c.siigo_email, ''), c.email) as client_email, c.email as orbit_email, c.siigo_email,
        c.phone as client_phone,
        i.issue_date, NULLIF(i.due_date, '') as due_date, i.amount, COALESCE(i.siigo_balance, i.amount) as pending_amount, i.siigo_total, i.siigo_balance, i.status, i.paid_date, i.siigo_id,
        i.promise_date::text as promise_date,
        COALESCE(i.collection_status, 'pending') as collection_status,
        ${DAYS_OUTSTANDING_SQL}::int as days_outstanding,
        p.name as project_name,
        (SELECT MAX(cr.sent_at) FROM collection_reminders cr WHERE cr.client_id = i.client_id AND cr.organization_id = i.organization_id) as last_reminder_at
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      ${where}
      ORDER BY i.issue_date ASC, i.id ASC
    `, params);

    const invoices = rows.map((r) => ({
      ...r,
      amount: Number(r.amount), pending_amount: Number(r.pending_amount ?? r.amount), siigo_total: r.siigo_total == null ? null : Number(r.siigo_total), siigo_balance: r.siigo_balance == null ? null : Number(r.siigo_balance),
      aging_bucket: agingBucket(r.days_outstanding),
      pdf_url: pdfUrlFor(r, req.orgId),
    }));

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cartera por mes de emisión (últimos 12 meses) + antigüedad + proyección de caja
router.get('/by-month', async (req, res) => {
  try {
    const monthRows = await db.all(`
      SELECT
        to_char(NULLIF(i.issue_date, '')::date, 'YYYY-MM') as month,
        COUNT(*)::int as invoice_count,
        COALESCE(SUM(i.amount), 0) as invoiced,
        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0) as collected,
        COALESCE(SUM(CASE WHEN i.status IN ('approved', 'invoiced') THEN COALESCE(i.siigo_balance, i.amount) ELSE 0 END), 0) as pending,
        COUNT(CASE WHEN i.status IN ('approved', 'invoiced') THEN 1 END)::int as pending_count
      FROM invoices i
      WHERE i.organization_id = ?
        AND i.status IN ('approved', 'invoiced', 'paid')
        AND NULLIF(i.issue_date, '')::date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '11 months')::date
      GROUP BY 1
      ORDER BY 1
    `, [req.orgId]);

    const byMonth = new Map(monthRows.map((r) => [r.month, r]));
    const { today } = await db.get(`SELECT CURRENT_DATE::text as today`);
    const [ty, tm] = today.split('-').map(Number);
    const months = [];
    for (let k = 11; k >= 0; k--) {
      const d = new Date(Date.UTC(ty, tm - 1 - k, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const r = byMonth.get(key);
      const invoiced = Number(r?.invoiced || 0);
      const collected = Number(r?.collected || 0);
      months.push({
        month: key,
        invoice_count: Number(r?.invoice_count || 0),
        pending_count: Number(r?.pending_count || 0),
        invoiced,
        collected,
        pending: Number(r?.pending || 0),
        pct_collected: invoiced > 0 ? Math.round((collected / invoiced) * 1000) / 10 : 0,
      });
    }

    const aging = await getAgingTotals(req.orgId);

    // Proyección: pendiente agrupado por semana según promesa de pago, si no vencimiento, si no "sin fecha"
    const openRows = await db.all(`
      SELECT i.id, COALESCE(i.siigo_balance, i.amount), ${TARGET_DATE_SQL} as target_date, (i.promise_date IS NOT NULL) as has_promise
      FROM invoices i
      WHERE i.status IN ('approved', 'invoiced') AND i.organization_id = ?
    `, [req.orgId]);

    const mondayOf = (dateStr) => {
      const d = new Date(dateStr + 'T00:00:00Z');
      const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
      d.setUTCDate(d.getUTCDate() - dow);
      return d;
    };
    const iso = (d) => d.toISOString().slice(0, 10);
    const currentWeekStart = mondayOf(today);

    const groups = new Map();
    const push = (key, base, row) => {
      if (!groups.has(key)) groups.set(key, { ...base, amount: 0, count: 0, with_promise: 0 });
      const g = groups.get(key);
      g.amount += Number(row.amount);
      g.count += 1;
      if (row.has_promise) g.with_promise += 1;
    };

    for (const row of openRows) {
      if (!row.target_date || !isDateStr(row.target_date)) {
        push('no_date', { kind: 'no_date', week_start: null, week_end: null }, row);
        continue;
      }
      const ws = mondayOf(row.target_date);
      if (ws < currentWeekStart) {
        push('overdue', { kind: 'overdue', week_start: null, week_end: iso(new Date(currentWeekStart.getTime() - 86400000)) }, row);
        continue;
      }
      const we = new Date(ws.getTime() + 6 * 86400000);
      push(iso(ws), { kind: 'week', week_start: iso(ws), week_end: iso(we) }, row);
    }

    const forecast = [...groups.values()].sort((a, b) => {
      const rank = { overdue: 0, week: 1, no_date: 2 };
      if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
      return (a.week_start || '').localeCompare(b.week_start || '');
    });

    const noDate = groups.get('no_date');
    res.json({
      today,
      months,
      aging,
      forecast,
      no_date_count: noDate ? noDate.count : 0,
      no_date_amount: noDate ? noDate.amount : 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar gestión de cobro de una factura (promesa de pago, estado de cobro, vencimiento)
router.put('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.get('SELECT id, collection_status FROM invoices WHERE id = ? AND organization_id = ?', [id, req.orgId]);
    if (!existing) return res.status(404).json({ error: 'Factura no encontrada' });

    const body = req.body || {};
    const sets = [];
    const params = [];

    if ('promise_date' in body) {
      if (body.promise_date !== null && body.promise_date !== '' && !isDateStr(body.promise_date)) {
        return res.status(400).json({ error: 'promise_date debe ser YYYY-MM-DD o null' });
      }
      sets.push('promise_date = ?');
      params.push(body.promise_date || null);
    }
    if ('due_date' in body) {
      if (body.due_date !== null && body.due_date !== '' && !isDateStr(body.due_date)) {
        return res.status(400).json({ error: 'due_date debe ser YYYY-MM-DD o null' });
      }
      sets.push('due_date = ?');
      params.push(body.due_date || null);
    }
    if ('collection_status' in body) {
      if (!COLLECTION_STATUSES.includes(body.collection_status)) {
        return res.status(400).json({ error: `collection_status debe ser uno de: ${COLLECTION_STATUSES.join(', ')}` });
      }
      sets.push('collection_status = ?');
      params.push(body.collection_status);
    } else if (body.promise_date && (existing.collection_status || 'pending') === 'pending') {
      // Si registran una promesa de pago sobre una factura sin gestión, pasa a "promised"
      sets.push('collection_status = ?');
      params.push('promised');
    }

    if (sets.length === 0) return res.status(400).json({ error: 'Nada que actualizar (promise_date, collection_status, due_date)' });

    params.push(id, req.orgId);
    await db.run(`UPDATE invoices SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`, params);

    const updated = await db.get(`
      SELECT i.id, i.invoice_number, i.client_id, i.issue_date, NULLIF(i.due_date, '') as due_date, i.amount, COALESCE(i.siigo_balance, i.amount) as pending_amount, i.siigo_total, i.siigo_balance, i.status,
        i.promise_date::text as promise_date, COALESCE(i.collection_status, 'pending') as collection_status,
        ${DAYS_OUTSTANDING_SQL}::int as days_outstanding
      FROM invoices i WHERE i.id = ? AND i.organization_id = ?
    `, [id, req.orgId]);
    updated.aging_bucket = agingBucket(updated.days_outstanding);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cobro masivo: envía (o programa) el estado de cuenta estándar a varios clientes con saldo pendiente
// body: { client_ids: [..], scheduled_for?: ISO }
router.post('/send-bulk', async (req, res) => {
  try {
    const { client_ids, scheduled_for } = req.body || {};
    if (!Array.isArray(client_ids) || client_ids.length === 0) {
      return res.status(400).json({ error: 'client_ids debe ser una lista con al menos un cliente' });
    }

    let scheduledDate = null;
    if (scheduled_for) {
      scheduledDate = new Date(scheduled_for);
      if (Number.isNaN(scheduledDate.getTime())) return res.status(400).json({ error: 'scheduled_for no es una fecha válida' });
      if (scheduledDate <= new Date()) return res.status(400).json({ error: 'La fecha programada debe ser en el futuro' });
    } else if (!process.env.RESEND_API_KEY && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
      return res.status(500).json({ error: 'Configuración de email no encontrada. Configura RESEND_API_KEY o EMAIL_USER/EMAIL_PASS.' });
    }

    // Máximo 1 envío por cliente por llamada
    const uniqueIds = [...new Set(client_ids.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))];
    const placeholders = uniqueIds.map(() => '?').join(',');

    const debtors = await db.all(`
      SELECT c.id as client_id, ${CLIENT_NAME_SQL} as client_name, COALESCE(NULLIF(c.siigo_email, ''), c.email) as email,
        COUNT(i.id)::int as invoice_count, SUM(COALESCE(i.siigo_balance, i.amount)) as total_owed
      FROM clients c
      JOIN invoices i ON i.client_id = c.id AND i.status IN ('approved', 'invoiced') AND i.organization_id = ?
      WHERE c.organization_id = ? AND c.id IN (${placeholders})
      GROUP BY c.id, c.company, c.name, c.email, c.siigo_email
    `, [req.orgId, req.orgId, ...uniqueIds]);

    const byId = new Map(debtors.map((d) => [Number(d.client_id), d]));
    const skipped = [];
    const results = [];
    let sent = 0;
    let scheduled = 0;

    for (const cid of uniqueIds) {
      const d = byId.get(cid);
      if (!d) { skipped.push({ client_id: cid, reason: 'Sin facturas pendientes o cliente no encontrado' }); continue; }
      if (!d.email || !d.email.trim()) { skipped.push({ client_id: cid, client_name: d.client_name, reason: 'El cliente no tiene email' }); continue; }

      try {
        if (scheduledDate) {
          const r = await db.run(`
            INSERT INTO scheduled_reminders (client_id, email_to, subject, custom_message, closing_message, invoice_ids, scheduled_for, created_by, organization_id)
            VALUES (?, ?, NULL, NULL, NULL, NULL, ?, ?, ?)
          `, [cid, d.email.trim(), scheduledDate.toISOString(), req.teamMember?.id || null, req.orgId]);
          scheduled += 1;
          results.push({ client_id: cid, client_name: d.client_name, email: d.email, status: 'scheduled', scheduled_id: r.lastInsertRowid, total_owed: Number(d.total_owed), invoice_count: d.invoice_count });
        } else {
          const built = await buildReminderEmail({ client_id: cid, orgId: req.orgId });
          const emailSubject = `Estado de Cuenta - ${built.clientDisplayName} | ${built.orgName}`;
          await sendEmail({
            from: `Estefania Hernandez <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: toList(d.email),
            cc: COLLECTIONS_CC.filter((e) => !toList(d.email).includes(e)),
            subject: emailSubject,
            html: built.html,
          });
          await db.run(`
            INSERT INTO collection_reminders (client_id, sent_to, subject, message, total_amount, invoice_count, sent_by, organization_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [cid, d.email.trim(), emailSubject, built.messageBody, built.totalOwed, built.invoiceCount, req.teamMember?.id || null, req.orgId]);
          sent += 1;
          results.push({ client_id: cid, client_name: d.client_name, email: d.email, status: 'sent', total_owed: built.totalOwed, invoice_count: built.invoiceCount });
        }
      } catch (err) {
        console.error(`Cobro masivo: error con cliente ${cid}:`, err.message);
        skipped.push({ client_id: cid, client_name: d.client_name, reason: err.message || 'Error enviando' });
      }
    }

    res.json({ sent, scheduled, skipped, results, scheduled_for: scheduledDate ? scheduledDate.toISOString() : null });
  } catch (error) {
    console.error('Error en cobro masivo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get collection detail for a specific client
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const rows = await db.all(`
      SELECT i.*, p.name as project_name,
        i.promise_date::text as promise_date_text,
        ${DAYS_OUTSTANDING_SQL}::int as days_outstanding
      FROM invoices i
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.client_id = ?
        AND i.status IN ('approved', 'invoiced')
        AND i.organization_id = ?
      ORDER BY i.issue_date ASC
    `, [clientId, req.orgId]);

    const invoices = rows.map(({ promise_date_text, ...r }) => ({
      ...r,
      promise_date: promise_date_text,
      collection_status: r.collection_status || 'pending',
      aging_bucket: agingBucket(r.days_outstanding),
      pdf_url: pdfUrlFor(r, req.orgId),
    }));

    const reminders = await db.all(`
      SELECT * FROM collection_reminders
      WHERE client_id = ? AND organization_id = ?
      ORDER BY sent_at DESC
    `, [clientId, req.orgId]);

    const client = await db.get(`
      SELECT id, name, company, COALESCE(NULLIF(siigo_email, ''), email) as email, email as orbit_email, siigo_email, siigo_contact_name, phone, nit
      FROM clients
      WHERE id = ? AND organization_id = ?
    `, [clientId, req.orgId]);

    res.json({ client, invoices, reminders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Preview reminder email (returns HTML without sending)
router.post('/preview-reminder', async (req, res) => {
  try {
    const { client_id, custom_message, closing_message, invoice_ids } = req.body;
    if (!client_id) {
      return res.status(400).json({ error: 'client_id es requerido' });
    }

    const result = await buildReminderEmail({
      client_id,
      custom_message,
      closing_message,
      invoice_ids,
      orgId: req.orgId,
    });

    res.json({
      html: result.html,
      subject: `Estado de Cuenta - ${result.clientDisplayName} | ${result.orgName}`,
      totalOwed: result.totalOwed,
      invoiceCount: result.invoiceCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send collection reminder email (estado de cuenta)
router.post('/send-reminder', async (req, res) => {
  try {
    const { client_id, email_to, subject, custom_message, closing_message, invoice_ids } = req.body;

    if (!client_id || !email_to) {
      return res.status(400).json({ error: 'client_id y email_to son requeridos' });
    }

    if (!process.env.RESEND_API_KEY && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
      return res.status(500).json({ error: 'Configuración de email no encontrada. Configura RESEND_API_KEY o EMAIL_USER/EMAIL_PASS.' });
    }

    const result = await buildReminderEmail({
      client_id,
      custom_message,
      closing_message,
      invoice_ids,
      orgId: req.orgId,
    });

    const emailSubject = subject || `Estado de Cuenta - ${result.clientDisplayName} | ${result.orgName}`;

    await sendEmail({
      from: `Estefania Hernandez <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toList(email_to),
      cc: COLLECTIONS_CC.filter((e) => !toList(email_to).includes(e)),
      subject: emailSubject,
      html: result.html,
    });

    // Record the reminder
    await db.run(`
      INSERT INTO collection_reminders (client_id, sent_to, subject, message, total_amount, invoice_count, sent_by, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [client_id, email_to, emailSubject, result.messageBody, result.totalOwed, result.invoiceCount, req.teamMember?.id || null, req.orgId]);

    res.json({ message: 'Recordatorio enviado exitosamente', totalOwed: result.totalOwed, invoiceCount: result.invoiceCount });
  } catch (error) {
    console.error('Collection email error:', error);
    res.status(500).json({ error: 'Error enviando recordatorio: ' + error.message });
  }
});

// ---------- Cobros por WhatsApp (Kapso) ----------
const WA_TEMPLATE_NAME = process.env.KAPSO_TEMPLATE_COBRO || 'estado_de_cuenta';
const WA_TEMPLATE_LANG = process.env.KAPSO_TEMPLATE_COBRO_LANG || 'es';
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const todayISO = () => new Date().toISOString().split('T')[0];

async function loadClientPendingInvoices({ client_id, invoice_ids, orgId }) {
  const client = await db.get(`
    SELECT id, name, company, email, phone, nit FROM clients WHERE id = ? AND organization_id = ?
  `, [client_id, orgId]);
  if (!client) throw new Error('Cliente no encontrado');

  let q = `
    SELECT i.* FROM invoices i
    WHERE i.client_id = ? AND i.status IN ('approved', 'invoiced') AND i.organization_id = ?
  `;
  const params = [client_id, orgId];
  if (invoice_ids && invoice_ids.length > 0) {
    q += ` AND i.id IN (${invoice_ids.map(() => '?').join(',')})`;
    params.push(...invoice_ids);
  }
  q += ' ORDER BY i.issue_date ASC';
  const invoices = await db.all(q, params);
  if (invoices.length === 0) throw new Error('No hay facturas pendientes para este cliente');

  const org = await db.get(`SELECT name FROM organizations WHERE id = ?`, [orgId]);
  return { client, invoices, orgName: org?.name || 'La Agencia', clientDisplayName: client.company || client.name };
}

const invoiceLine = (inv) => {
  const amount = Number(inv.siigo_balance ?? inv.amount);
  const due = inv.due_date && inv.due_date < todayISO()
    ? `vencida hace ${Math.floor((new Date() - new Date(inv.due_date + 'T00:00:00')) / 86400000)} días`
    : (inv.due_date ? `vence ${inv.due_date}` : 'pendiente');
  return { number: inv.invoice_number, amount, due };
};

/** Arma el texto del estado de cuenta para WhatsApp (texto libre) y los parámetros de la plantilla */
async function buildReminderWhatsApp({ client_id, invoice_ids, custom_message, orgId }) {
  const { client, invoices, orgName, clientDisplayName } = await loadClientPendingInvoices({ client_id, invoice_ids, orgId });
  const lines = invoices.map(invoiceLine);
  const totalOwed = lines.reduce((sum, l) => sum + l.amount, 0);
  const count = invoices.length;
  const facturas = `${count} factura${count === 1 ? '' : 's'}`;
  const closing = (custom_message && String(custom_message).trim())
    || 'Si ya realizaste el pago, por favor envíanos el comprobante por este medio para actualizar tu estado de cuenta. ¡Gracias!';

  const text = [
    `Hola, ${clientDisplayName} 👋`,
    `Te escribe ${orgName} (Administración y Cartera). A la fecha registramos ${facturas} pendiente${count === 1 ? '' : 's'} de pago por un total de *${money(totalOwed)}*:`,
    '',
    ...lines.map((l) => `• ${l.number} — ${money(l.amount)} — ${l.due}`),
    '',
    closing,
  ].join('\n');

  // Los parámetros de plantilla no admiten saltos de línea: detalle en una sola línea
  const detalle = lines.map((l) => `${l.number} (${money(l.amount)}, ${l.due})`).join(' · ');
  const templateParams = { cliente: clientDisplayName, agencia: orgName, facturas, total: money(totalOwed), detalle };

  return {
    client, clientDisplayName, orgName, totalOwed, invoiceCount: count, text, templateParams,
    phone: normalizeWaNumber(client.phone || ''),
  };
}

// Preview del mensaje de WhatsApp (texto + si hay plantilla aprobada disponible)
router.post('/preview-whatsapp', async (req, res) => {
  try {
    const { client_id, invoice_ids, custom_message } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id es requerido' });
    const built = await buildReminderWhatsApp({ client_id, invoice_ids, custom_message, orgId: req.orgId });
    const template = isKapsoConfigured() ? await getApprovedTemplate(WA_TEMPLATE_NAME, WA_TEMPLATE_LANG) : null;
    res.json({
      configured: isKapsoConfigured(),
      text: built.text,
      phone: built.phone,
      phone_formatted: built.phone ? formatWaNumber(built.phone) : '',
      total: built.totalOwed,
      invoice_count: built.invoiceCount,
      template_available: Boolean(template),
      template_name: WA_TEMPLATE_NAME,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Envía el estado de cuenta por WhatsApp.
 * mode: 'auto' (plantilla aprobada si existe, si no texto) | 'template' | 'text'
 * Las plantillas llegan siempre; el texto libre solo si el cliente escribió en las últimas 24 h.
 */
router.post('/send-whatsapp', async (req, res) => {
  try {
    const { client_id, phone, invoice_ids, custom_message, mode = 'auto' } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id es requerido' });
    if (!isKapsoConfigured()) return res.status(503).json({ error: 'WhatsApp no está configurado en Orbit (KAPSO_API_KEY / KAPSO_PHONE_NUMBER_ID)' });

    const built = await buildReminderWhatsApp({ client_id, invoice_ids, custom_message, orgId: req.orgId });
    const to = normalizeWaNumber(phone || built.phone);
    if (!to || to.length < 8) return res.status(400).json({ error: 'El cliente no tiene un número de WhatsApp válido' });

    const context = { source: 'cartera', invoice_ids: invoice_ids || null, total: built.totalOwed };
    const template = mode === 'text' ? null : await getApprovedTemplate(WA_TEMPLATE_NAME, WA_TEMPLATE_LANG);
    if (mode === 'template' && !template) {
      return res.status(400).json({ error: `La plantilla "${WA_TEMPLATE_NAME}" no está aprobada todavía en Meta` });
    }

    let result;
    let channelUsed;
    if (template) {
      const bodyParams = (template.components?.find((c) => c.type === 'BODY')?.text || '').match(/{{\s*([a-z0-9_]+)\s*}}/gi) || [];
      const named = template.parameter_format === 'NAMED' || bodyParams.some((p) => !/^{{\s*\d+\s*}}$/.test(p));
      const order = ['cliente', 'agencia', 'facturas', 'total', 'detalle'];
      const used = named
        ? bodyParams.map((p) => p.replace(/[{}\s]/g, '').toLowerCase()).filter((k) => k in built.templateParams)
        : order.slice(0, bodyParams.length);
      const parameters = used.map((k) => (named
        ? { type: 'text', parameter_name: k, text: built.templateParams[k] }
        : { type: 'text', text: built.templateParams[k] }));
      result = await sendTemplateAndRecord({
        orgId: req.orgId, to, name: template.name, language: template.language || WA_TEMPLATE_LANG,
        components: parameters.length ? [{ type: 'body', parameters }] : [],
        renderedText: built.text, clientId: client_id, context: { ...context, template: template.name }, sentBy: req.teamMember?.id || null,
      });
      channelUsed = 'template';
    } else {
      result = await sendTextAndRecord({ orgId: req.orgId, to, body: built.text, clientId: client_id, context, sentBy: req.teamMember?.id || null });
      channelUsed = 'text';
    }

    await db.run(`
      INSERT INTO collection_reminders (client_id, sent_to, subject, message, total_amount, invoice_count, sent_by, organization_id, channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp')
    `, [client_id, `+${to}`, `WhatsApp · Estado de cuenta ${built.clientDisplayName}`, built.text, built.totalOwed, built.invoiceCount, req.teamMember?.id || null, req.orgId]);

    res.json({
      message: channelUsed === 'template'
        ? `Estado de cuenta enviado por WhatsApp (plantilla) a ${formatWaNumber(to)}`
        : `Estado de cuenta enviado por WhatsApp a ${formatWaNumber(to)}. Si el cliente no ha escrito en las últimas 24 h, Meta puede no entregarlo: revisa el estado en la bandeja de WhatsApp.`,
      channel_used: channelUsed,
      wamid: result.wamid,
      totalOwed: built.totalOwed,
      invoiceCount: built.invoiceCount,
    });
  } catch (error) {
    console.error('Collection WhatsApp error:', error);
    res.status(error.status && error.status < 500 ? 400 : 500).json({ error: 'Error enviando por WhatsApp: ' + error.message });
  }
});

// Get reminder history
router.get('/reminders', async (req, res) => {
  try {
    const { client_id } = req.query;
    let query = `
      SELECT cr.*,
        CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END as client_name
      FROM collection_reminders cr
      JOIN clients c ON cr.client_id = c.id
      WHERE cr.organization_id = ?
    `;
    const params = [req.orgId];

    if (client_id) {
      query += ' AND cr.client_id = ?';
      params.push(client_id);
    }

    query += ' ORDER BY cr.sent_at DESC LIMIT 100';
    const reminders = await db.all(query, params);
    res.json(reminders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add manual note to collection
router.post('/notes', async (req, res) => {
  try {
    const { client_id, note, follow_up_date } = req.body;
    if (!client_id || !note) {
      return res.status(400).json({ error: 'client_id y note son requeridos' });
    }

    const result = await db.run(`
      INSERT INTO collection_notes (client_id, note, follow_up_date, created_by, organization_id)
      VALUES (?, ?, ?, ?, ?)
    `, [client_id, note, follow_up_date || null, req.teamMember?.id || null, req.orgId]);

    const created = await db.get('SELECT * FROM collection_notes WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get collection notes for a client
router.get('/notes/:clientId', async (req, res) => {
  try {
    const notes = await db.all(`
      SELECT cn.*, tm.name as created_by_name
      FROM collection_notes cn
      LEFT JOIN team_members tm ON cn.created_by = tm.id
      WHERE cn.client_id = ? AND cn.organization_id = ?
      ORDER BY cn.created_at DESC
    `, [req.params.clientId, req.orgId]);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark invoice as paid (quick action from collections)
router.post('/mark-paid', async (req, res) => {
  try {
    const { invoice_id, paid_date, payment_proof } = req.body;
    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id es requerido' });
    }

    const today = paid_date || new Date().toISOString().split('T')[0];

    await db.run(`
      UPDATE invoices SET status = 'paid', paid_date = ?, payment_proof = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [today, payment_proof || null, invoice_id, req.orgId]);

    await db.run(`
      INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by)
      VALUES (?, 'invoiced', 'paid', ?)
    `, [invoice_id, req.teamMember?.id || null]);

    res.json({ message: 'Factura marcada como pagada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry failed scheduled reminders and process pending ones now
router.post('/process-scheduled', async (req, res) => {
  try {
    await db.run(`UPDATE scheduled_reminders SET status = 'pending' WHERE status = 'failed' AND organization_id = ?`, [req.orgId]);

    const { processScheduledReminders } = await import('../services/scheduledReminders.js');
    await processScheduledReminders();

    const results = await db.all(`SELECT id, email_to, status, error_message, sent_at, scheduled_for FROM scheduled_reminders WHERE organization_id = ? ORDER BY scheduled_for DESC`, [req.orgId]);
    res.json({ message: 'Procesamiento completado', results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule a reminder for later
router.post('/schedule-reminder', async (req, res) => {
  try {
    const { client_id, email_to, subject, custom_message, closing_message, invoice_ids, scheduled_for } = req.body;

    if (!client_id || !email_to || !scheduled_for) {
      return res.status(400).json({ error: 'client_id, email_to y scheduled_for son requeridos' });
    }

    const scheduledDate = new Date(scheduled_for);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'La fecha programada debe ser en el futuro' });
    }

    const result = await db.run(`
      INSERT INTO scheduled_reminders (client_id, email_to, subject, custom_message, closing_message, invoice_ids, scheduled_for, created_by, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id,
      email_to,
      subject || null,
      custom_message || null,
      closing_message || null,
      invoice_ids ? JSON.stringify(invoice_ids) : null,
      scheduled_for,
      req.teamMember?.id || null,
      req.orgId,
    ]);

    res.status(201).json({ message: 'Recordatorio programado exitosamente', id: result.lastInsertRowid, scheduled_for });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List scheduled reminders
router.get('/scheduled', async (req, res) => {
  try {
    const { client_id } = req.query;
    let query = `
      SELECT sr.*,
        CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END as client_name
      FROM scheduled_reminders sr
      JOIN clients c ON sr.client_id = c.id
      WHERE sr.organization_id = ?
    `;
    const params = [req.orgId];

    if (client_id) {
      query += ' AND sr.client_id = ?';
      params.push(client_id);
    }

    query += ' ORDER BY sr.scheduled_for DESC LIMIT 50';
    const scheduled = await db.all(query, params);
    res.json(scheduled);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a scheduled reminder
router.delete('/scheduled/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const reminder = await db.get('SELECT * FROM scheduled_reminders WHERE id = ? AND organization_id = ?', [id, req.orgId]);

    if (!reminder) return res.status(404).json({ error: 'Recordatorio no encontrado' });
    if (reminder.status !== 'pending') return res.status(400).json({ error: 'Solo se pueden cancelar recordatorios pendientes' });

    await db.run('DELETE FROM scheduled_reminders WHERE id = ?', [id]);
    res.json({ message: 'Recordatorio cancelado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
