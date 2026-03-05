import express from 'express';
import db from '../config/database.js';
import { getEmailTransporter } from '../utils/emailHelper.js';

const router = express.Router();

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

  const totalOwed = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  const org = await db.get(`SELECT name, logo_url FROM organizations WHERE id = ?`, [orgId]);
  const orgName = org?.name || 'La Agencia';

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
                      <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Emision</th>
                      <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Vence</th>
                      <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Proyecto</th>
                      <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Monto</th>
                      <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Estado</th>
                    </tr>
                    ${invoiceRows}
                    <tr style="background-color: #F9FAFB;">
                      <td colspan="4" style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #111827;">TOTAL</td>
                      <td style="padding: 14px 16px; font-size: 16px; font-weight: 800; color: #111827; text-align: right;">$${totalOwed.toLocaleString('es-CO')}</td>
                      <td></td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td style="padding: 0 40px 32px;">
                  <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
                    ${closingBody}
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; border-top: 1px solid #E5E7EB; background-color: #F9FAFB;">
                  <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0;">Estefania Hernandez</p>
                  <p style="color: #6B7280; font-size: 13px; margin: 4px 0 0;">Administracion y Cartera</p>
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

// Get collections summary (dashboard data)
router.get('/summary', async (req, res) => {
  try {
    const overdue = await db.all(`
      SELECT
        c.id as client_id,
        CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END as client_name,
        c.email as client_email,
        c.phone as client_phone,
        COUNT(i.id) as invoice_count,
        SUM(i.amount) as total_owed,
        MIN(i.issue_date) as oldest_invoice_date,
        MIN(i.due_date) as oldest_due_date,
        MAX(cr.sent_at) as last_reminder_sent
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN collection_reminders cr ON cr.client_id = c.id AND cr.organization_id = i.organization_id
      WHERE i.status IN ('approved', 'invoiced')
        AND i.organization_id = ?
      GROUP BY c.id, c.company, c.name, c.email, c.phone
      ORDER BY total_owed DESC
    `, [req.orgId]);

    const stats = await db.get(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE::text THEN 1 END) as overdue_count,
        COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE::text THEN amount ELSE 0 END), 0) as overdue_amount
      FROM invoices
      WHERE status IN ('approved', 'invoiced')
        AND organization_id = ?
    `, [req.orgId]);

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

// Get collection detail for a specific client
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const invoices = await db.all(`
      SELECT i.*, p.name as project_name
      FROM invoices i
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.client_id = ?
        AND i.status IN ('approved', 'invoiced')
        AND i.organization_id = ?
      ORDER BY i.issue_date ASC
    `, [clientId, req.orgId]);

    const reminders = await db.all(`
      SELECT * FROM collection_reminders
      WHERE client_id = ? AND organization_id = ?
      ORDER BY sent_at DESC
    `, [clientId, req.orgId]);

    const client = await db.get(`
      SELECT id, name, company, email, phone, nit
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

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ error: 'Configuracion de email no encontrada. Configura EMAIL_USER y EMAIL_PASS.' });
    }

    const result = await buildReminderEmail({
      client_id,
      custom_message,
      closing_message,
      invoice_ids,
      orgId: req.orgId,
    });

    const emailSubject = subject || `Estado de Cuenta - ${result.clientDisplayName} | ${result.orgName}`;

    const transporter = getEmailTransporter();

    await transporter.sendMail({
      from: `"Estefania Hernandez - ${result.orgName}" <${process.env.EMAIL_USER}>`,
      to: email_to,
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
