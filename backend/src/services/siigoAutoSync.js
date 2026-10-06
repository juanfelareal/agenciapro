/**
 * Siigo Auto Sync Service
 * Automatically syncs invoices and expenses from Siigo for all configured organizations.
 * Runs 5 times daily via cron jobs (7AM, 10AM, 1PM, 4PM, 7PM Colombia time).
 */

import db from '../config/database.js';
import siigoService from './siigoService.js';

/**
 * Helper: Get date string in YYYY-MM-DD format
 */
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Sync invoices from Siigo for a specific organization
 */
export async function syncInvoicesForOrg(orgId, days = 7) {
  const results = { imported: 0, skipped: 0, errors: [] };

  try {
    // Sync last N days (default 7) to cover backdated invoices
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const siigoInvoices = await siigoService.getInvoices(
      orgId,
      1,
      100,
      formatDate(startDate),
      formatDate(endDate)
    );
    const invoices = siigoInvoices?.results || [];

    for (const siigoInv of invoices) {
      try {
        // Check if invoice already exists
        const existing = await db.prepare(
          'SELECT id FROM invoices WHERE siigo_id = ? AND organization_id = ?'
        ).get(siigoInv.id, orgId);

        if (existing) {
          results.skipped++;
          continue;
        }

        // Try to match client by NIT or name
        const customerName = siigoInv.customer?.name?.[0] || 'Cliente Siigo';
        const customerNit = siigoInv.customer?.identification;

        let clientId = null;
        if (customerNit) {
          const clientByNit = await db.prepare(
            'SELECT id FROM clients WHERE nit = ? AND organization_id = ?'
          ).get(customerNit, orgId);
          clientId = clientByNit?.id;
        }

        if (!clientId) {
          const clientByName = await db.prepare(
            'SELECT id FROM clients WHERE (company LIKE ? OR name LIKE ?) AND organization_id = ?'
          ).get(`%${customerName}%`, `%${customerName}%`, orgId);
          clientId = clientByName?.id;
        }

        // Calculate amount
        const amount = siigoInv.items?.reduce((sum, item) => {
          const qty = item.quantity || 1;
          const price = item.price || 0;
          return sum + (qty * price);
        }, 0) || 0;

        // Determine status
        const balance = siigoInv.balance || 0;
        const status = balance <= 0 ? 'paid' : 'invoiced';

        // Número de factura = prefijo + consecutivo de Siigo (ej. FV-1-1234). invoice_number es NOT NULL/UNIQUE,
        // por eso el import fallaba silenciosamente antes. Fecha de vencimiento desde el primer pago de Siigo.
        const prefix = siigoInv.prefix || siigoInv.name || siigoInv.document?.id || 'FV';
        let invoiceNumber = siigoInv.number ? `${prefix}-${siigoInv.number}` : `SIIGO-${String(siigoInv.id).slice(0, 8)}`;
        const clash = await db.prepare('SELECT id FROM invoices WHERE invoice_number = ? AND organization_id = ?').get(invoiceNumber, orgId);
        if (clash) invoiceNumber = `${invoiceNumber}-${String(siigoInv.id).slice(0, 6)}`;
        const dueDate = siigoInv.payments?.[0]?.due_date?.split('T')[0] || null;

        await db.prepare(`
          INSERT INTO invoices (
            invoice_number, client_id, amount, issue_date, due_date, status, siigo_id, siigo_status,
            invoice_type, notes, organization_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', 'con_iva', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          invoiceNumber,
          clientId,
          amount,
          siigoInv.date?.split('T')[0] || new Date().toISOString().split('T')[0],
          dueDate,
          status,
          siigoInv.id,
          `Importado de Siigo: ${invoiceNumber}`,
          orgId
        );

        results.imported++;
      } catch (err) {
        results.errors.push({ siigoId: siigoInv.id, error: err.message });
      }
    }
  } catch (err) {
    results.errors.push({ type: 'fetch', error: err.message });
  }

  return results;
}

/**
 * Sync expenses from Siigo for a specific organization
 */
async function syncExpensesForOrg(orgId) {
  const results = { imported: 0, skipped: 0, errors: [] };

  try {
    // Sync last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const [paymentReceipts, purchases] = await Promise.all([
      siigoService.getPaymentReceipts(orgId, formatDate(startDate), formatDate(endDate)),
      siigoService.getPurchases(orgId, formatDate(startDate), formatDate(endDate))
    ]);

    // Process payment receipts (egresos)
    for (const pr of paymentReceipts) {
      try {
        const siigoId = `pr_${pr.id}`;

        const existing = await db.prepare(
          'SELECT id FROM expenses WHERE siigo_id = ? AND organization_id = ?'
        ).get(siigoId, orgId);

        if (existing) {
          results.skipped++;
          continue;
        }

        const amount = pr.items?.reduce((sum, item) => {
          return sum + Math.abs(item.value || 0);
        }, 0) || 0;

        const supplierName = pr.supplier?.name || 'Proveedor Siigo';

        await db.prepare(`
          INSERT INTO expenses (
            description, amount, expense_date, category, siigo_id, notes,
            organization_id, created_at, updated_at
          ) VALUES (?, ?, ?, 'Operación', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          `Egreso Siigo: ${supplierName}`,
          amount,
          pr.date?.split('T')[0] || new Date().toISOString().split('T')[0],
          siigoId,
          pr.observations || '',
          orgId
        );

        results.imported++;
      } catch (err) {
        results.errors.push({ siigoId: pr.id, type: 'payment_receipt', error: err.message });
      }
    }

    // Process purchases
    for (const purchase of purchases) {
      try {
        const siigoId = `pu_${purchase.id}`;

        const existing = await db.prepare(
          'SELECT id FROM expenses WHERE siigo_id = ? AND organization_id = ?'
        ).get(siigoId, orgId);

        if (existing) {
          results.skipped++;
          continue;
        }

        const amount = purchase.items?.reduce((sum, item) => {
          const qty = item.quantity || 1;
          const price = item.price || 0;
          return sum + (qty * price);
        }, 0) || 0;

        const supplierName = purchase.supplier?.name || 'Proveedor Siigo';

        await db.prepare(`
          INSERT INTO expenses (
            description, amount, expense_date, category, siigo_id, notes,
            organization_id, created_at, updated_at
          ) VALUES (?, ?, ?, 'Operación', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          `Compra Siigo: ${supplierName}`,
          amount,
          purchase.date?.split('T')[0] || new Date().toISOString().split('T')[0],
          siigoId,
          `Factura: ${purchase.prefix || ''}-${purchase.number || ''}`,
          orgId
        );

        results.imported++;
      } catch (err) {
        results.errors.push({ siigoId: purchase.id, type: 'purchase', error: err.message });
      }
    }
  } catch (err) {
    results.errors.push({ type: 'fetch', error: err.message });
  }

  return results;
}

/**
 * Main function: Sync Siigo for ALL organizations with active Siigo integration
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Revisa en Siigo el saldo de cada factura ABIERTA (approved/invoiced) que vino de Siigo y
 * la marca como pagada cuando el saldo ya es 0. Sin esto, la cartera solo bajaba a mano.
 * `dryRun` solo cuenta, no escribe.
 */
async function getInvoiceWithRetry(orgId, siigoId, attempts = 4) {
  for (let a = 1; a <= attempts; a++) {
    try {
      return await siigoService.getInvoice(orgId, siigoId);
    } catch (err) {
      const m = /Rate limit.*?(\d+)\s*seconds?/i.exec(err.message || '');
      if (m && a < attempts) {
        const wait = (parseInt(m[1], 10) + 2) * 1000;
        console.log(`[SiigoAutoSync] Rate limit de Siigo, esperando ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

export async function refreshOpenInvoiceBalances(orgId, { dryRun = false, concurrency = 2, onProgress = null } = {}) {
  const results = { checked: 0, markedPaid: 0, stillOpen: 0, errors: [], paidInvoices: [], total: 0 };
  const open = await db.prepare(`
    SELECT id, siigo_id, invoice_number, amount, client_id FROM invoices
    WHERE organization_id = ? AND siigo_id IS NOT NULL AND status IN ('approved', 'invoiced')
  `).all(orgId);

  results.total = open.length;
  const today = new Date().toISOString().split('T')[0];
  for (let i = 0; i < open.length; i += concurrency) {
    const batch = open.slice(i, i + concurrency);
    await Promise.all(batch.map(async (inv) => {
      try {
        const detail = await getInvoiceWithRetry(orgId, inv.siigo_id);
        results.checked++;
        const balance = Number(detail?.balance ?? 0);
        if (balance <= 0) {
          results.markedPaid++;
          results.paidInvoices.push({ id: inv.id, invoice_number: inv.invoice_number, amount: inv.amount, client_id: inv.client_id });
          if (!dryRun) {
            await db.prepare(`
              UPDATE invoices SET status = 'paid', paid_date = COALESCE(paid_date, ?), updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND organization_id = ?
            `).run(today, inv.id, orgId);
            await db.prepare(`
              INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by)
              VALUES (?, 'invoiced', 'paid', NULL)
            `).run(inv.id);
          }
        } else {
          results.stillOpen++;
        }
      } catch (err) {
        results.errors.push({ invoiceId: inv.id, siigoId: inv.siigo_id, error: err.message });
      }
    }));
    if (onProgress) onProgress({ done: Math.min(i + concurrency, open.length), total: open.length, markedPaid: results.markedPaid });
    if (i + concurrency < open.length) await sleep(700); // ~100 req/min es el límite de Siigo
  }
  return results;
}

// ── Job en segundo plano por organización (para el botón de Cartera) ──
const syncJobs = new Map(); // orgId → { status, startedAt, finishedAt, progress, result, error, dryRun }

export function getSyncJob(orgId) {
  return syncJobs.get(orgId) || null;
}

export function startSyncJob(orgId, { days = 30, dryRun = false } = {}) {
  const current = syncJobs.get(orgId);
  if (current?.status === 'running') return current;
  const job = { status: 'running', startedAt: new Date().toISOString(), finishedAt: null, progress: { done: 0, total: 0, markedPaid: 0 }, result: null, error: null, dryRun };
  syncJobs.set(orgId, job);
  (async () => {
    try {
      const imported = dryRun ? { imported: 0, skipped: 0, errors: [] } : await syncInvoicesForOrg(orgId, days);
      const balances = await refreshOpenInvoiceBalances(orgId, { dryRun, onProgress: (p) => { job.progress = p; } });
      job.result = {
        imported: imported.imported, already_existed: imported.skipped,
        checked: balances.checked, marked_paid: balances.markedPaid, still_open: balances.stillOpen,
        paid_invoices: balances.paidInvoices, errors: [...imported.errors, ...balances.errors],
      };
      job.status = 'done';
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  })();
  return job;
}

/**
 * Sincronización manual de una organización (botón en Cartera): importa facturas nuevas
 * de los últimos `days` días y actualiza el estado de pago de las abiertas.
 */
export async function syncOrgNow(orgId, { days = 30, dryRun = false } = {}) {
  const imported = dryRun ? { imported: 0, skipped: 0, errors: [] } : await syncInvoicesForOrg(orgId, days);
  const balances = await refreshOpenInvoiceBalances(orgId, { dryRun });
  return { imported, balances };
}

export async function syncSiigoForAllOrgs() {
  const startedAt = new Date();
  console.log('[SiigoAutoSync] Starting automatic sync...');

  const summary = {
    organizations: 0,
    invoices: { imported: 0, skipped: 0, errors: 0 },
    expenses: { imported: 0, skipped: 0, errors: 0 },
    orgErrors: []
  };

  try {
    // Get all organizations with active Siigo
    const siigoOrgs = await db.prepare(
      'SELECT DISTINCT organization_id FROM siigo_settings WHERE is_active = 1'
    ).all();

    summary.organizations = siigoOrgs.length;
    console.log(`[SiigoAutoSync] Found ${siigoOrgs.length} organizations with Siigo configured`);

    for (const row of siigoOrgs) {
      const orgId = row.organization_id;
      console.log(`[SiigoAutoSync] Syncing org ${orgId}...`);

      try {
        // Sync invoices
        const invResults = await syncInvoicesForOrg(orgId);
        summary.invoices.imported += invResults.imported;
        summary.invoices.skipped += invResults.skipped;
        summary.invoices.errors += invResults.errors.length;

        // Marcar pagadas las facturas abiertas cuyo saldo en Siigo ya es 0
        try {
          const bal = await refreshOpenInvoiceBalances(orgId);
          if (bal.markedPaid) console.log(`[SiigoAutoSync] Org ${orgId}: ${bal.markedPaid} facturas marcadas como pagadas (saldo 0 en Siigo)`);
        } catch (err) {
          console.error(`[SiigoAutoSync] Error refrescando saldos org ${orgId}:`, err.message);
        }

        // Sync expenses
        const expResults = await syncExpensesForOrg(orgId);
        summary.expenses.imported += expResults.imported;
        summary.expenses.skipped += expResults.skipped;
        summary.expenses.errors += expResults.errors.length;

        console.log(`[SiigoAutoSync] Org ${orgId}: ${invResults.imported} invoices, ${expResults.imported} expenses imported`);
      } catch (err) {
        console.error(`[SiigoAutoSync] Error syncing org ${orgId}:`, err.message);
        summary.orgErrors.push({ orgId, error: err.message });
      }
    }
  } catch (err) {
    console.error('[SiigoAutoSync] Fatal error:', err.message);
  }

  const finishedAt = new Date();
  const durationMs = finishedAt - startedAt;

  console.log('[SiigoAutoSync] Completed in', durationMs, 'ms');
  console.log('[SiigoAutoSync] Summary:', JSON.stringify(summary));

  return { startedAt, finishedAt, durationMs, summary };
}

export default { syncSiigoForAllOrgs, syncOrgNow, refreshOpenInvoiceBalances, syncInvoicesForOrg, startSyncJob, getSyncJob };
