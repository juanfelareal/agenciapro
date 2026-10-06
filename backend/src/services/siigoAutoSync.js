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
/**
 * Inserta en Orbit una factura de Siigo si no existe (match de cliente por NIT o nombre).
 * Devuelve 'imported' | 'skipped'.
 */
export async function importSiigoInvoice(orgId, siigoInv) {
  const existing = await db.prepare(
    'SELECT id FROM invoices WHERE siigo_id = ? AND organization_id = ?'
  ).get(siigoInv.id, orgId);
  if (existing) return 'skipped';

  const customerName = siigoInv.customer?.name?.[0] || 'Cliente Siigo';
  const customerNit = siigoInv.customer?.identification;
  let clientId = null;
  if (customerNit) {
    const byNit = await db.prepare('SELECT id FROM clients WHERE nit = ? AND organization_id = ?').get(customerNit, orgId);
    clientId = byNit?.id;
  }
  if (!clientId) {
    const byName = await db.prepare(
      'SELECT id FROM clients WHERE (company LIKE ? OR name LIKE ?) AND organization_id = ?'
    ).get(`%${customerName}%`, `%${customerName}%`, orgId);
    clientId = byName?.id;
  }

  // Valor sin IVA (suma de ítems) como `amount`; total y saldo reales de Siigo aparte
  const amount = siigoInv.items?.reduce((sum, item) => sum + (item.quantity || 1) * (item.price || 0), 0) || 0;
  const total = Number(siigoInv.total ?? amount);
  const balance = Number(siigoInv.balance ?? 0);
  const status = balance <= 0 ? 'paid' : 'invoiced';

  // Número de factura = prefijo + consecutivo de Siigo (ej. LMFE-609). invoice_number es NOT NULL/UNIQUE.
  const prefix = siigoInv.prefix || siigoInv.name || siigoInv.document?.id || 'FV';
  let invoiceNumber = siigoInv.number ? `${prefix}-${siigoInv.number}` : `SIIGO-${String(siigoInv.id).slice(0, 8)}`;
  const clash = await db.prepare('SELECT id FROM invoices WHERE invoice_number = ? AND organization_id = ?').get(invoiceNumber, orgId);
  if (clash) invoiceNumber = `${invoiceNumber}-${String(siigoInv.id).slice(0, 6)}`;
  const dueDate = siigoInv.payments?.[0]?.due_date?.split('T')[0] || null;
  const issueDate = siigoInv.date?.split('T')[0] || new Date().toISOString().split('T')[0];

  await db.prepare(`
    INSERT INTO invoices (
      invoice_number, client_id, amount, issue_date, due_date, status, siigo_id, siigo_status,
      siigo_total, siigo_balance, siigo_balance_synced_at,
      invoice_type, notes, organization_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, CURRENT_TIMESTAMP, 'con_iva', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(invoiceNumber, clientId, amount, issueDate, dueDate, status, siigoInv.id, total, balance, `Importado de Siigo: ${invoiceNumber}`, orgId);
  return 'imported';
}

/** Importa las facturas de Siigo de los últimos N días (por fecha de documento). */
export async function syncInvoicesForOrg(orgId, days = 7) {
  const results = { imported: 0, skipped: 0, errors: [] };
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const siigoInvoices = await siigoService.getInvoices(orgId, 1, 100, formatDate(startDate), formatDate(endDate));
    for (const siigoInv of siigoInvoices?.results || []) {
      try {
        const r = await importSiigoInvoice(orgId, siigoInv);
        results[r]++;
      } catch (err) {
        results.errors.push({ siigoId: siigoInv.id, error: err.message });
      }
    }
  } catch (err) {
    results.errors.push({ type: 'fetch', error: err.message });
  }
  return results;
}

/** Todas las facturas de Siigo (paginado, ~100 por llamada). */
async function fetchAllSiigoInvoices(orgId, onPage = null) {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const data = await siigoService.getInvoices(orgId, page, 100);
    const rows = data?.results || [];
    all.push(...rows);
    if (onPage) onPage(all.length, data?.pagination?.total_results || all.length);
    const total = data?.pagination?.total_results || 0;
    if (!rows.length || all.length >= total) break;
    await new Promise((r) => setTimeout(r, 700)); // ~100 req/min en Siigo
  }
  return all;
}

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
/**
 * Cuadra la cartera con Siigo usando la lista completa de facturas (7 llamadas en vez de una por factura):
 *  - guarda total y saldo real de Siigo (con IVA y pagos parciales) en cada factura abierta,
 *  - marca pagadas las que ya tienen saldo 0,
 *  - importa facturas de Siigo con saldo que no existían en Orbit (sin importar la fecha),
 *  - reporta facturas abiertas en Orbit que no aparecen en Siigo.
 * `dryRun` solo cuenta.
 */
export async function refreshOpenInvoiceBalances(orgId, { dryRun = false, onProgress = null } = {}) {
  const results = { checked: 0, markedPaid: 0, stillOpen: 0, importedOpen: 0, notInSiigo: [], errors: [], paidInvoices: [], total: 0 };
  const all = await fetchAllSiigoInvoices(orgId, (done, total) => { if (onProgress) onProgress({ done, total, markedPaid: 0, phase: 'siigo' }); });
  const byId = new Map(all.map((inv) => [String(inv.id), inv]));

  const open = await db.prepare(`
    SELECT id, siigo_id, invoice_number, amount, client_id FROM invoices
    WHERE organization_id = ? AND siigo_id IS NOT NULL AND status IN ('approved', 'invoiced')
  `).all(orgId);
  results.total = open.length;
  const today = new Date().toISOString().split('T')[0];

  for (const [i, inv] of open.entries()) {
    try {
      const s = byId.get(String(inv.siigo_id));
      if (!s) { results.notInSiigo.push({ id: inv.id, invoice_number: inv.invoice_number, amount: inv.amount }); continue; }
      results.checked++;
      const total = Number(s.total ?? inv.amount);
      const balance = Number(s.balance ?? 0);
      if (!dryRun) {
        await db.prepare(`UPDATE invoices SET siigo_total = ?, siigo_balance = ?, siigo_balance_synced_at = CURRENT_TIMESTAMP WHERE id = ?`).run(total, balance, inv.id);
      }
      if (balance <= 0) {
        results.markedPaid++;
        results.paidInvoices.push({ id: inv.id, invoice_number: inv.invoice_number, amount: inv.amount, client_id: inv.client_id });
        if (!dryRun) {
          await db.prepare(`UPDATE invoices SET status = 'paid', paid_date = COALESCE(paid_date, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`).run(today, inv.id, orgId);
          await db.prepare(`INSERT INTO invoice_status_history (invoice_id, from_status, to_status, changed_by) VALUES (?, 'invoiced', 'paid', NULL)`).run(inv.id);
        }
      } else {
        results.stillOpen++;
      }
    } catch (err) {
      results.errors.push({ invoiceId: inv.id, siigoId: inv.siigo_id, error: err.message });
    }
    if (onProgress) onProgress({ done: i + 1, total: open.length, markedPaid: results.markedPaid, phase: 'orbit' });
  }

  // Facturas con saldo en Siigo que Orbit no conoce (p. ej. creadas en Siigo hace meses)
  for (const s of all) {
    if (Number(s.balance ?? 0) <= 0) continue;
    try {
      if (dryRun) {
        const exists = await db.prepare('SELECT id FROM invoices WHERE siigo_id = ? AND organization_id = ?').get(s.id, orgId);
        if (!exists) results.importedOpen++;
      } else if ((await importSiigoInvoice(orgId, s)) === 'imported') {
        results.importedOpen++;
      }
    } catch (err) {
      results.errors.push({ siigoId: s.id, error: err.message });
    }
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
        imported_open: balances.importedOpen, not_in_siigo: balances.notInSiigo,
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

export default { syncSiigoForAllOrgs, syncOrgNow, refreshOpenInvoiceBalances, syncInvoicesForOrg, importSiigoInvoice, startSyncJob, getSyncJob };
