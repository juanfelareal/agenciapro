import db from '../config/database.js';
import { sendEmail } from '../utils/emailHelper.js';

// Reuse the same email builder from collections route
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

  const totalOwed = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const org = await db.get(`SELECT name, logo_url FROM organizations WHERE id = ?`, [orgId]);
  const orgName = org?.name || 'La Agencia';

  const defaultMessage = `Esperamos que se encuentren bien. Les enviamos el estado de cuenta actualizado de ${clientDisplayName} con ${orgName}. Les pedimos el favor nos envien el comprobante de pago de cada una de estas facturas para poderlo relacionar en nuestra contabilidad.`;
  const messageBody = custom_message || defaultMessage;
  const defaultClosing = `Si ya realizaron el pago, por favor enviennos el comprobante para actualizar su estado de cuenta. Quedamos atentos a cualquier inquietud.`;
  const closingBody = closing_message || defaultClosing;

  const today = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  const invoiceRows = invoices.map((inv) => {
    const isOverdue = inv.due_date && inv.due_date < new Date().toISOString().split('T')[0];
    const statusColor = isOverdue ? '#DC2626' : '#F59E0B';
    const statusText = isOverdue ? 'Vencida' : 'Pendiente';
    return `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 14px 16px; font-size: 14px; color: #374151;">${inv.invoice_number}</td>
        <td style="padding: 14px 16px; font-size: 14px; color: #374151;">${inv.issue_date}</td>
        <td style="padding: 14px 16px; font-size: 14px; color: #374151;">${inv.due_date || '-'}</td>
        <td style="padding: 14px 16px; font-size: 14px; color: #374151;">${inv.project_name || '-'}</td>
        <td style="padding: 14px 16px; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">$${Number(inv.amount).toLocaleString('es-CO')}</td>
        <td style="padding: 14px 16px; text-align: center;">
          <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; color: white; background-color: ${statusColor};">${statusText}</span>
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              <tr><td style="background-color: #1A1A2E; padding: 32px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0"><tr>
                  <td><h1 style="color: #BFFF00; margin: 0; font-size: 22px; font-weight: 700;">${orgName}</h1><p style="color: rgba(255,255,255,0.7); margin: 6px 0 0; font-size: 13px;">Estado de Cuenta</p></td>
                  <td style="text-align: right;"><p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 13px;">${today}</p></td>
                </tr></table>
              </td></tr>
              <tr><td style="padding: 32px 40px 16px;">
                <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px;">Cliente</p>
                <h2 style="color: #111827; margin: 0; font-size: 20px; font-weight: 700;">${clientDisplayName}</h2>
                ${client.nit ? `<p style="color: #6B7280; margin: 4px 0 0; font-size: 14px;">NIT: ${client.nit}</p>` : ''}
              </td></tr>
              <tr><td style="padding: 8px 40px 24px;"><p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0;">${messageBody}</p></td></tr>
              <tr><td style="padding: 0 40px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1A1A2E 0%, #2D2D4E 100%); border-radius: 12px;">
                  <tr><td style="padding: 24px 28px;">
                    <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px;">Saldo Total Pendiente</p>
                    <p style="color: #BFFF00; font-size: 32px; font-weight: 800; margin: 0;">$${totalOwed.toLocaleString('es-CO')}</p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 6px 0 0;">${invoices.length} factura${invoices.length > 1 ? 's' : ''} pendiente${invoices.length > 1 ? 's' : ''}</p>
                  </td></tr>
                </table>
              </td></tr>
              <tr><td style="padding: 0 40px 32px;">
                <p style="color: #111827; font-size: 16px; font-weight: 700; margin: 0 0 12px;">Detalle de Facturas</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E5E7EB; border-radius: 10px; overflow: hidden;">
                  <tr style="background-color: #F9FAFB;">
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Factura</th>
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Emision</th>
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Vence</th>
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Proyecto</th>
                    <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Monto</th>
                    <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Estado</th>
                  </tr>
                  ${invoiceRows}
                  <tr style="background-color: #F9FAFB;">
                    <td colspan="4" style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #111827;">TOTAL</td>
                    <td style="padding: 14px 16px; font-size: 16px; font-weight: 800; color: #111827; text-align: right;">$${totalOwed.toLocaleString('es-CO')}</td>
                    <td></td>
                  </tr>
                </table>
              </td></tr>
              <tr><td style="padding: 0 40px 32px;"><p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">${closingBody}</p></td></tr>
              <tr><td style="padding: 24px 40px; border-top: 1px solid #E5E7EB; background-color: #F9FAFB;">
                <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0;">Estefania Hernandez</p>
                <p style="color: #6B7280; font-size: 13px; margin: 4px 0 0;">Administracion y Cartera</p>
                <p style="color: #6B7280; font-size: 13px; margin: 2px 0 0;">${orgName}</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return { html, messageBody, clientDisplayName, orgName, totalOwed, invoiceCount: invoices.length };
}

export async function processScheduledReminders() {
  try {
    const pending = await db.all(`
      SELECT * FROM scheduled_reminders
      WHERE status = 'pending' AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC
    `, []);

    if (pending.length === 0) return;

    console.log(`📧 Processing ${pending.length} scheduled reminder(s)...`);

    if (!process.env.RESEND_API_KEY && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
      console.error('❌ Email not configured, skipping scheduled reminders');
      return;
    }

    for (const reminder of pending) {
      try {
        const invoiceIds = reminder.invoice_ids ? JSON.parse(reminder.invoice_ids) : null;

        const result = await buildReminderEmail({
          client_id: reminder.client_id,
          custom_message: reminder.custom_message,
          closing_message: reminder.closing_message,
          invoice_ids: invoiceIds,
          orgId: reminder.organization_id,
        });

        const emailSubject = reminder.subject || `Estado de Cuenta - ${result.clientDisplayName} | ${result.orgName}`;

        await sendEmail({
          from: `Estefania Hernandez <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
          to: reminder.email_to,
          subject: emailSubject,
          html: result.html,
        });

        // Rate limit: wait 1 second between emails
        await new Promise(r => setTimeout(r, 1000));

        // Record in collection_reminders
        await db.run(`
          INSERT INTO collection_reminders (client_id, sent_to, subject, message, total_amount, invoice_count, sent_by, organization_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [reminder.client_id, reminder.email_to, emailSubject, result.messageBody, result.totalOwed, result.invoiceCount, reminder.created_by, reminder.organization_id]);

        // Mark as sent
        await db.run(`UPDATE scheduled_reminders SET status = 'sent', sent_at = NOW() WHERE id = ?`, [reminder.id]);

        console.log(`  ✅ Sent scheduled reminder #${reminder.id} to ${reminder.email_to}`);
      } catch (err) {
        await db.run(`UPDATE scheduled_reminders SET status = 'failed', error_message = ? WHERE id = ?`, [err.message, reminder.id]);
        console.error(`  ❌ Failed reminder #${reminder.id}: ${err.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error processing scheduled reminders:', error.message);
  }
}
