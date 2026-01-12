import express from 'express';
import db from '../config/database.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Email configuration (will be configured via .env)
const getEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Get all invoices
router.get('/', async (req, res) => {
  try {
    const { status, client_id } = req.query;
    let query = `
      SELECT i.*,
        CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END as client_name,
        c.email as client_email,
        p.name as project_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (client_id) {
      query += ' AND i.client_id = ?';
      params.push(client_id);
    }

    query += ' ORDER BY i.created_at DESC';
    const invoices = await db.prepare(query).all(...params);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get invoice by ID
router.get('/:id', async (req, res) => {
  try {
    const invoice = await db.prepare(`
      SELECT i.*,
        CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END as client_name,
        c.email as client_email,
        p.name as project_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate next recurrence date
const calculateNextRecurrenceDate = (fromDate, frequency) => {
  const date = new Date(fromDate);
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return null;
  }
  return date.toISOString().split('T')[0];
};

// Create new invoice
router.post('/', async (req, res) => {
  try {
    const { client_id, project_id, amount, invoice_type, status, issue_date, notes, is_recurring, recurrence_frequency, recurrence_status, next_recurrence_date: providedNextDate } = req.body;

    if (!client_id || !amount || !issue_date) {
      return res.status(400).json({ error: 'Client, amount, and issue date are required' });
    }

    // Auto-generate invoice number - find max FAC number
    const allInvoices = await db.prepare("SELECT invoice_number FROM invoices WHERE invoice_number LIKE 'FAC-%'").all();
    let maxNumber = 0;
    allInvoices.forEach(inv => {
      const match = inv.invoice_number.match(/FAC-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });
    const invoice_number = `FAC-${String(maxNumber + 1).padStart(4, '0')}`;

    // Use provided next_recurrence_date or calculate if not provided
    let next_recurrence_date = null;
    if (is_recurring && recurrence_frequency) {
      next_recurrence_date = providedNextDate || calculateNextRecurrenceDate(issue_date, recurrence_frequency);
    }

    const result = await db.prepare(`
      INSERT INTO invoices (invoice_number, client_id, project_id, amount, invoice_type, status, issue_date, notes, is_recurring, recurrence_frequency, recurrence_status, next_recurrence_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoice_number, client_id, project_id, amount, invoice_type || 'con_iva', status || 'draft', issue_date, notes, is_recurring ? 1 : 0, recurrence_frequency || null, recurrence_status || 'draft', next_recurrence_date);

    const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update invoice (supports partial updates for bulk operations)
router.put('/:id', async (req, res) => {
  try {
    const { client_id, project_id, amount, invoice_type, status, issue_date, paid_date, notes, payment_proof, changed_by, is_recurring, recurrence_frequency, recurrence_status, next_recurrence_date: providedNextDate } = req.body;

    // Get current invoice to check status change and preserve existing values
    const currentInvoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!currentInvoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    const oldStatus = currentInvoice.status;

    // Use provided values or keep existing ones (for partial updates / bulk operations)
    const updatedClientId = client_id !== undefined ? client_id : currentInvoice.client_id;
    const updatedProjectId = project_id !== undefined ? project_id : currentInvoice.project_id;
    const updatedAmount = amount !== undefined ? amount : currentInvoice.amount;
    const updatedInvoiceType = invoice_type !== undefined ? invoice_type : currentInvoice.invoice_type;
    const updatedStatus = status !== undefined ? status : currentInvoice.status;
    const updatedIssueDate = issue_date !== undefined ? issue_date : currentInvoice.issue_date;
    const updatedPaidDate = paid_date !== undefined ? paid_date : currentInvoice.paid_date;
    const updatedPaymentProof = payment_proof !== undefined ? payment_proof : currentInvoice.payment_proof;
    const updatedNotes = notes !== undefined ? notes : currentInvoice.notes;
    const updatedIsRecurring = is_recurring !== undefined ? (is_recurring ? 1 : 0) : currentInvoice.is_recurring;
    const updatedRecurrenceFrequency = recurrence_frequency !== undefined ? recurrence_frequency : currentInvoice.recurrence_frequency;
    const updatedRecurrenceStatus = recurrence_status !== undefined ? recurrence_status : currentInvoice.recurrence_status;

    // Calculate next_recurrence_date if recurring
    let updatedNextRecurrenceDate = currentInvoice.next_recurrence_date;
    if (providedNextDate !== undefined) {
      updatedNextRecurrenceDate = providedNextDate;
    } else if (updatedIsRecurring && updatedRecurrenceFrequency && updatedIssueDate) {
      updatedNextRecurrenceDate = calculateNextRecurrenceDate(updatedIssueDate, updatedRecurrenceFrequency);
    }

    await db.prepare(`
      UPDATE invoices
      SET client_id = ?, project_id = ?, amount = ?, invoice_type = ?,
          status = ?, issue_date = ?, paid_date = ?, payment_proof = ?,
          notes = ?, is_recurring = ?, recurrence_frequency = ?, recurrence_status = ?, next_recurrence_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updatedClientId, updatedProjectId, updatedAmount, updatedInvoiceType || 'con_iva',
      updatedStatus, updatedIssueDate, updatedPaidDate, updatedPaymentProof,
      updatedNotes, updatedIsRecurring, updatedRecurrenceFrequency || null,
      updatedRecurrenceStatus || 'draft', updatedNextRecurrenceDate, req.params.id
    );

    // Track status change in history
    if (oldStatus && oldStatus !== updatedStatus) {
      await db.prepare(`
        INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by)
        VALUES (?, ?, ?, ?)
      `).run(req.params.id, oldStatus, updatedStatus, changed_by || null);

      // Create notification when status changes to 'approved'
      if (updatedStatus === 'approved') {
        // Get all admin/manager users to notify
        const admins = await db.prepare(`
          SELECT id FROM team_members
          WHERE role IN ('admin', 'manager') AND status = 'active'
        `).all();

        const invoice = await db.prepare(`
          SELECT i.*, c.company as client_name
          FROM invoices i
          LEFT JOIN clients c ON i.client_id = c.id
          WHERE i.id = ?
        `).get(req.params.id);

        for (const admin of admins) {
          await db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
            VALUES (?, 'task_assigned', ?, ?, 'invoice', ?)
          `).run(
            admin.id,
            'Factura aprobada para facturar',
            `La factura ${invoice.invoice_number} de ${invoice.client_name || 'cliente'} está lista para facturar.`,
            req.params.id
          );
        }
      }
    }

    const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get invoice status history
router.get('/:id/history', async (req, res) => {
  try {
    const history = await db.prepare(`
      SELECT h.*, t.name as changed_by_name
      FROM invoice_status_history h
      LEFT JOIN team_members t ON h.changed_by = t.id
      WHERE h.invoice_id = ?
      ORDER BY h.changed_at DESC
    `).all(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send invoice by email
router.post('/:id/send', async (req, res) => {
  try {
    const invoice = await db.prepare(`
      SELECT i.*, c.name as client_name, c.email as client_email, p.name as project_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!invoice.client_email) {
      return res.status(400).json({ error: 'Client does not have an email address' });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ error: 'Email configuration not set. Please configure EMAIL_USER and EMAIL_PASS in .env file' });
    }

    const transporter = getEmailTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: invoice.client_email,
      subject: `Factura #${invoice.invoice_number} - AgenciaPro`,
      html: `
        <h2>Factura #${invoice.invoice_number}</h2>
        <p>Estimado/a ${invoice.client_name},</p>
        <p>Adjuntamos la factura correspondiente a los servicios prestados.</p>
        <br>
        <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Número de Factura:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${invoice.invoice_number}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Fecha de Emisión:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${invoice.issue_date}</td>
          </tr>
          ${invoice.due_date ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Fecha de Vencimiento:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${invoice.due_date}</td>
          </tr>
          ` : ''}
          ${invoice.project_name ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Proyecto:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${invoice.project_name}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Monto Total:</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd; font-size: 18px; font-weight: bold;">$${invoice.amount.toLocaleString('es-CO')}</td>
          </tr>
        </table>
        ${invoice.notes ? `<br><p><strong>Notas:</strong> ${invoice.notes}</p>` : ''}
        <br>
        <p>Saludos cordiales,<br>El equipo de AgenciaPro</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    // Update invoice status to 'sent'
    await db.prepare('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('sent', req.params.id);

    res.json({ message: 'Invoice sent successfully' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email: ' + error.message });
  }
});

// Delete invoice
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
