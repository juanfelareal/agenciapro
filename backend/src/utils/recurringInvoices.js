import db from '../config/database.js';

// Helper function to create recurring invoice
export const createRecurringInvoice = async (client) => {
  const today = new Date();
  const billingDay = client.billing_day || today.getDate();

  // Determine the invoice date
  let invoiceDate = new Date(today.getFullYear(), today.getMonth(), billingDay);

  // If billing day has passed this month, schedule for next month
  if (invoiceDate < today) {
    invoiceDate = new Date(today.getFullYear(), today.getMonth() + 1, billingDay);
  }

  // Generate invoice number with format: INV-CLIENTID-YYYYMM-REC
  const yearMonth = `${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
  const invoiceNumber = `INV-${client.id}-${yearMonth}-REC`;

  // Format dates as YYYY-MM-DD
  const issueDateStr = invoiceDate.toISOString().split('T')[0];

  // Due date is 30 days after issue date
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 30);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  try {
    // Check if invoice already exists (scoped by org)
    const existing = await db.prepare(
      'SELECT id FROM invoices WHERE invoice_number = ? AND organization_id = ?'
    ).get(invoiceNumber, client.organization_id);
    if (existing) {
      console.log(`Invoice ${invoiceNumber} already exists, skipping creation`);
      return null;
    }

    const result = await db.prepare(`
      INSERT INTO invoices (invoice_number, client_id, amount, status, issue_date, due_date, notes, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceNumber,
      client.id,
      client.recurring_amount,
      'draft',
      issueDateStr,
      dueDateStr,
      `Factura recurrente generada automáticamente para ${client.company || client.name}`,
      client.organization_id
    );

    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error creating recurring invoice:', error);
    return null;
  }
};

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

// Process invoice-based recurring invoices
const processInvoiceRecurring = async () => {
  const today = new Date().toISOString().split('T')[0];

  // Get all recurring invoices that are due today or earlier (across all orgs — cron job)
  const recurringInvoices = await db.prepare(`
    SELECT i.*,
      CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END as client_name,
      c.organization_id
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.is_recurring = 1
      AND i.next_recurrence_date IS NOT NULL
      AND i.next_recurrence_date <= ?
  `).all(today);

  let created = 0;

  for (const invoice of recurringInvoices) {
    try {
      // Generate new invoice number (scoped by org)
      const orgId = invoice.organization_id;
      const allInvoices = await db.prepare(
        "SELECT invoice_number FROM invoices WHERE invoice_number LIKE 'FAC-%' AND organization_id = ?"
      ).all(orgId);
      let maxNumber = 0;
      allInvoices.forEach(inv => {
        const match = inv.invoice_number.match(/FAC-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) maxNumber = num;
        }
      });
      const newInvoiceNumber = `FAC-${String(maxNumber + 1).padStart(4, '0')}`;

      // Create new invoice with the recurrence_status (includes org_id)
      const result = await db.prepare(`
        INSERT INTO invoices (invoice_number, client_id, project_id, amount, invoice_type, status, issue_date, notes, is_recurring, recurrence_frequency, recurrence_status, next_recurrence_date, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newInvoiceNumber,
        invoice.client_id,
        invoice.project_id,
        invoice.amount,
        invoice.invoice_type,
        invoice.recurrence_status || 'draft',
        today,
        invoice.notes ? `${invoice.notes} (Recurrente)` : 'Factura recurrente generada automáticamente',
        1, // Keep as recurring
        invoice.recurrence_frequency,
        invoice.recurrence_status,
        calculateNextRecurrenceDate(today, invoice.recurrence_frequency),
        orgId
      );

      // Update the original invoice's next_recurrence_date
      await db.prepare(`
        UPDATE invoices SET next_recurrence_date = ? WHERE id = ?
      `).run(calculateNextRecurrenceDate(today, invoice.recurrence_frequency), invoice.id);

      created++;
      console.log(`✅ Created recurring invoice #${result.lastInsertRowid} for client ${invoice.client_name}`);
    } catch (error) {
      console.error(`❌ Error creating recurring invoice for ${invoice.invoice_number}:`, error);
    }
  }

  return created;
};

// Process all recurring invoices for active clients
export const processRecurringInvoices = async () => {
  try {
    const today = new Date();
    const currentDay = today.getDate();

    console.log(`🔄 [${new Date().toISOString()}] Checking for recurring invoices (Day ${currentDay})...`);

    // 1. Process client-based recurring invoices (across all orgs — cron job)
    const clients = await db.prepare(`
      SELECT * FROM clients
      WHERE is_recurring = 1
        AND status = 'active'
        AND billing_day = ?
    `).all(currentDay);  // No org filter needed — cron processes all orgs, each client carries its organization_id

    let clientCreated = 0;
    let clientSkipped = 0;

    if (clients.length > 0) {
      console.log(`Found ${clients.length} recurring client(s) for day ${currentDay}`);

      for (const client of clients) {
        const invoiceId = await createRecurringInvoice(client);
        if (invoiceId) {
          clientCreated++;
          console.log(`✅ Created invoice #${invoiceId} for ${client.company} ($${client.recurring_amount})`);
        } else {
          clientSkipped++;
        }
      }
    }

    // 2. Process invoice-based recurring invoices
    const invoiceCreated = await processInvoiceRecurring();

    console.log(`✅ Recurring invoices processed: ${clientCreated + invoiceCreated} created, ${clientSkipped} skipped`);
  } catch (error) {
    console.error('❌ Error processing recurring invoices:', error);
  }
};

// Manual trigger for testing
export const triggerRecurringInvoices = async () => {
  console.log('🔧 Manually triggering recurring invoice generation...');
  await processRecurringInvoices();
};
