import express from 'express';
import db from '../config/database.js';
import * as financials from '../services/clientFinancialsService.js';
import * as edits from '../services/clientFinancialsEdits.js';
import * as lab from '../services/financialLab.js';
import { getScalability, normalizeBasis } from '../services/scalability.js';
import { buildFinancialsWorkbook, financialsExportFilename, getClientBrandName } from '../services/financialsExport.js';
import { backfillDiscounts } from '../services/discountsBackfill.js';
import * as scenarios from '../services/financialScenarios.js';
import * as orderLedger from '../services/orderLedger.js';

const router = express.Router();

// ─── Helpers ───
const getCurrentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const verifyClient = async (clientId, orgId) => {
  const client = await db.get('SELECT id FROM clients WHERE id = $1 AND organization_id = $2', [clientId, orgId]);
  return !!client;
};

// Errores del servicio de ediciones financieras (err.status = 400/403/404) → respuesta HTTP
const sendEditError = (res, error, label) => {
  if (!error?.status) console.error(`Error ${label}:`, error);
  res.status(error?.status || 500).json({ error: error?.message, ...(error?.needs_reconnect ? { needs_reconnect: true } : {}) });
};

// Fecha de hoy en hora Colombia (YYYY-MM-DD)
const getColombiaDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);
const pct = (numerator, denominator) => (denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : null);

// Venta por email del mes (campañas + flows) desde client_monthly_email_metrics
const getEmailMonth = async (clientId, orgId, period) => {
  const empty = { revenue_mtd: 0, campaigns_revenue: 0, flows_revenue: 0, conversions: 0, deliveries: 0, has_data: false };
  try {
    const [year, month] = period.split('-').map(Number);
    const row = await db.get(`
      SELECT campaigns_revenue, flows_revenue, campaigns_conversions, flows_conversions, campaigns_deliveries, flows_deliveries
      FROM client_monthly_email_metrics
      WHERE client_id = $1 AND organization_id = $2 AND year = $3 AND month = $4
    `, [clientId, orgId, year, month]);
    if (!row) return empty;
    const campaigns = num(row.campaigns_revenue);
    const flows = num(row.flows_revenue);
    return {
      revenue_mtd: campaigns + flows,
      campaigns_revenue: campaigns,
      flows_revenue: flows,
      conversions: num(row.campaigns_conversions) + num(row.flows_conversions),
      deliveries: num(row.campaigns_deliveries) + num(row.flows_deliveries),
      has_data: true,
    };
  } catch (e) {
    console.log('Error fetching email month metrics:', e.message);
    return empty;
  }
};

// ─── Client visibility ───

// Toggle hide client from general metrics
router.put('/clients/:clientId/hide', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { is_hidden } = req.body;
    await db.run(
      'UPDATE clients SET is_hidden_from_metrics = $1 WHERE id = $2 AND organization_id = $3',
      [is_hidden ? 1 : 0, clientId, req.orgId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling client visibility:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set client service type (growth / fee / null)
router.put('/clients/:clientId/service-type', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { service_type } = req.body;
    await db.run(
      'UPDATE clients SET service_type = $1 WHERE id = $2 AND organization_id = $3',
      [service_type || null, clientId, req.orgId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting service type:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update client commission settings
router.put('/clients/:clientId/commission', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { commission_rate, commission_deduction, commission_threshold, commission_rate_above } = req.body;
    await db.run(
      `UPDATE clients
       SET commission_rate = $1, commission_deduction = $2, commission_threshold = $3, commission_rate_above = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND organization_id = $6`,
      [commission_rate || 0, commission_deduction || 0, commission_threshold || 0, commission_rate_above || 0, clientId, req.orgId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating commission settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get client commission settings
router.get('/clients/:clientId/commission', async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await db.get(
      'SELECT commission_rate, commission_deduction, commission_threshold, commission_rate_above FROM clients WHERE id = $1 AND organization_id = $2',
      [clientId, req.orgId]
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (error) {
    console.error('Error getting commission settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get growth clients with metrics summary
// ─── BE ROAS por marca (para la tabla del dashboard de Growth) ───
router.get('/be-roas', async (req, res) => {
  try {
    const today = financials.todayColombia();
    const start = /^\d{4}-\d{2}-\d{2}$/.test(req.query.start || '') ? req.query.start : `${today.slice(0, 7)}-01`;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(req.query.end || '') ? (req.query.end > today ? today : req.query.end) : today;
    const rows = await db.all('SELECT id FROM clients WHERE organization_id = ? AND status != ?', [req.orgId, 'inactive']);
    const hidden = new Set((req.hiddenClientIds || []).map(Number));
    const ids = rows.map((r) => Number(r.id)).filter((id) => !hidden.has(id));
    const data = await financials.beRoasForClients(req.orgId, ids, start, end);
    res.json({ start, end, clients: data });
  } catch (error) {
    console.error('Error BE ROAS:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clients', async (req, res) => {
  try {
    const clients = await db.all(`
      SELECT c.id, c.name, c.nickname, c.company, c.service_type, c.is_hidden_from_metrics,
             COALESCE(c.commission_rate, 0) as commission_rate,
             COALESCE(c.commission_deduction, 0) as commission_deduction,
             COALESCE(c.commission_threshold, 0) as commission_threshold,
             COALESCE(c.commission_rate_above, 0) as commission_rate_above
      FROM clients c
      WHERE c.organization_id = $1 AND c.service_type = 'growth' AND c.status != 'inactive'
      ORDER BY c.nickname ASC, c.name ASC
    `, [req.orgId]);
    res.json(clients);
  } catch (error) {
    console.error('Error getting growth clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all client data for a period (objectives + palancas + milestones + banderas)
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const period = req.query.period || getCurrentPeriod();
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const [objectives, palancas, milestones, banderas, email] = await Promise.all([
      db.all('SELECT * FROM growth_objectives WHERE client_id = $1 AND period = $2 AND organization_id = $3', [clientId, period, req.orgId]),
      db.all('SELECT * FROM growth_palancas WHERE client_id = $1 AND period = $2 AND organization_id = $3 ORDER BY rank ASC', [clientId, period, req.orgId]),
      db.all('SELECT * FROM growth_milestones WHERE client_id = $1 AND period = $2 AND organization_id = $3', [clientId, period, req.orgId]),
      db.all('SELECT * FROM growth_banderas WHERE client_id = $1 AND period = $2 AND organization_id = $3 AND is_active = 1', [clientId, period, req.orgId]),
      getEmailMonth(clientId, req.orgId, period),
    ]);

    res.json({ objectives, palancas, milestones, banderas, email });
  } catch (error) {
    console.error('Error getting growth data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tasa de conversión en el tiempo: web (semanal lunes–domingo + mensual) y email (mensual)
// GET /growth/:clientId/conversion?months=6&period=YYYY-MM
router.get('/:clientId/conversion', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
    const today = getColombiaDate();
    const currentPeriod = today.substring(0, 7);
    const period = /^\d{4}-\d{2}$/.test(req.query.period || '') ? req.query.period : currentPeriod;
    const [py, pm] = period.split('-').map(Number);

    // Rango: desde el día 1 de (period - months + 1) hasta el fin del period (o hoy si es el mes en curso)
    const startD = new Date(Date.UTC(py, pm - 1 - (months - 1), 1));
    const startDate = startD.toISOString().split('T')[0];
    const lastDay = new Date(py, pm, 0).getDate();
    const endDate = period === currentPeriod ? today : `${period}-${String(lastDay).padStart(2, '0')}`;

    // Lista completa de meses del rango (para que las series mensuales sean continuas)
    const monthKeys = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth() + i, 1));
      monthKeys.push(d.toISOString().substring(0, 7));
    }

    // Semanas lunes–domingo (date_trunc('week') en Postgres es ISO: arranca lunes). metric_date ya es fecha local Colombia.
    const weekRows = await db.all(`
      SELECT
        to_char(date_trunc('week', metric_date::date), 'YYYY-MM-DD') AS week_start,
        to_char(date_trunc('week', metric_date::date) + interval '6 days', 'YYYY-MM-DD') AS week_end,
        COUNT(*) AS days,
        COALESCE(SUM(shopify_sessions), 0) AS sessions,
        COALESCE(SUM(shopify_orders), 0) AS orders
      FROM client_daily_metrics
      WHERE client_id = $1 AND metric_date >= $2 AND metric_date <= $3
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `, [clientId, startDate, endDate]);

    const monthRows = await db.all(`
      SELECT
        substr(metric_date, 1, 7) AS month,
        COALESCE(SUM(shopify_sessions), 0) AS sessions,
        COALESCE(SUM(shopify_orders), 0) AS orders
      FROM client_daily_metrics
      WHERE client_id = $1 AND metric_date >= $2 AND metric_date <= $3
      GROUP BY 1
      ORDER BY 1 ASC
    `, [clientId, startDate, endDate]);

    let emailRows = [];
    try {
      emailRows = await db.all(`
        SELECT year, month, campaigns_conversions, flows_conversions, campaigns_deliveries, flows_deliveries,
               campaigns_revenue, flows_revenue
        FROM client_monthly_email_metrics
        WHERE client_id = $1 AND organization_id = $2
          AND (year * 100 + month) >= $3 AND (year * 100 + month) <= $4
        ORDER BY year ASC, month ASC
      `, [clientId, req.orgId, Number(monthKeys[0].replace('-', '')), Number(period.replace('-', ''))]);
    } catch (e) {
      console.log('Error fetching email conversion metrics:', e.message);
    }

    const weeks = weekRows.map((w) => {
      const sessions = num(w.sessions);
      const orders = num(w.orders);
      return {
        week_start: w.week_start,
        week_end: w.week_end,
        days: num(w.days),
        sessions,
        orders,
        conversion_rate: pct(orders, sessions),
      };
    });

    const webByMonth = Object.fromEntries(monthRows.map((r) => [r.month, r]));
    const emailByMonth = Object.fromEntries(emailRows.map((r) => [`${r.year}-${String(r.month).padStart(2, '0')}`, r]));

    const monthsOut = monthKeys.map((month) => {
      const w = webByMonth[month];
      const e = emailByMonth[month];
      const sessions = num(w?.sessions);
      const orders = num(w?.orders);
      const emailDeliveries = e ? num(e.campaigns_deliveries) + num(e.flows_deliveries) : 0;
      const emailConversions = e ? num(e.campaigns_conversions) + num(e.flows_conversions) : 0;
      return {
        month,
        sessions,
        orders,
        conversion_rate: pct(orders, sessions),
        email_has_data: !!e,
        email_deliveries: emailDeliveries,
        email_conversions: emailConversions,
        email_conversion_rate: e ? pct(emailConversions, emailDeliveries) : null,
        email_revenue: e ? num(e.campaigns_revenue) + num(e.flows_revenue) : 0,
      };
    });

    res.json({
      period,
      start_date: startDate,
      end_date: endDate,
      weeks,
      months: monthsOut,
      has_sessions: weeks.some((w) => w.sessions > 0),
      has_email: emailRows.length > 0,
    });
  } catch (error) {
    console.error('Error getting conversion data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Objectives CRUD ───

router.post('/:clientId/objectives', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period, metric, conservador, base, optimista } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    res.json(await edits.upsertObjective(clientId, req.orgId, { period, metric, conservador, base, optimista }));
  } catch (error) {
    sendEditError(res, error, 'creating objective');
  }
});

router.put('/objectives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { conservador, base, optimista } = req.body;
    await db.run(
      'UPDATE growth_objectives SET conservador = $1, base = $2, optimista = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND organization_id = $5',
      [conservador, base, optimista, id, req.orgId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating objective:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Palancas CRUD ───

router.post('/:clientId/palancas', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period, rank, nombre, estado, kpi_label, kpi_valor, impacto } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const result = await db.run(`
      INSERT INTO growth_palancas (client_id, period, rank, nombre, estado, kpi_label, kpi_valor, impacto, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [clientId, period || getCurrentPeriod(), rank || 1, nombre, estado, kpi_label, kpi_valor, impacto || 'medio', req.orgId]);

    res.json({ id: result.lastID });
  } catch (error) {
    console.error('Error creating palanca:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/palancas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rank, nombre, estado, kpi_label, kpi_valor, impacto } = req.body;
    await db.run(`
      UPDATE growth_palancas SET rank = $1, nombre = $2, estado = $3, kpi_label = $4, kpi_valor = $5, impacto = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND organization_id = $8
    `, [rank, nombre, estado, kpi_label, kpi_valor, impacto, id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating palanca:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/palancas/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM growth_palancas WHERE id = $1 AND organization_id = $2', [req.params.id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Milestones CRUD ───

router.post('/:clientId/milestones', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period, nombre, meta, status, responsable } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const result = await db.run(`
      INSERT INTO growth_milestones (client_id, period, nombre, meta, status, responsable, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [clientId, period || getCurrentPeriod(), nombre, meta, status || 'pending', responsable || 'lareal', req.orgId]);

    res.json({ id: result.lastID });
  } catch (error) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/milestones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, meta, status, responsable } = req.body;
    await db.run(`
      UPDATE growth_milestones SET nombre = $1, meta = $2, status = $3, responsable = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND organization_id = $6
    `, [nombre, meta, status, responsable, id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/milestones/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM growth_milestones WHERE id = $1 AND organization_id = $2', [req.params.id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Banderas CRUD ───

router.post('/:clientId/banderas', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period, nivel, titulo, descripcion } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const result = await db.run(`
      INSERT INTO growth_banderas (client_id, period, nivel, titulo, descripcion, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [clientId, period || getCurrentPeriod(), nivel || 'media', titulo, descripcion, req.orgId]);

    res.json({ id: result.lastID });
  } catch (error) {
    console.error('Error creating bandera:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/banderas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nivel, titulo, descripcion, is_active } = req.body;
    await db.run(`
      UPDATE growth_banderas SET nivel = $1, titulo = $2, descripcion = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND organization_id = $6
    `, [nivel, titulo, descripcion, is_active ?? 1, id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/banderas/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM growth_banderas WHERE id = $1 AND organization_id = $2', [req.params.id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Fixed Costs CRUD ───

// Get all fixed costs for a client
router.get('/clients/:clientId/fixed-costs', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    res.json(await edits.listFixedCosts(clientId, req.orgId));
  } catch (error) {
    console.error('Error getting fixed costs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create fixed cost
router.post('/clients/:clientId/fixed-costs', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    res.json(await edits.createFixedCost(clientId, req.orgId, req.body));
  } catch (error) {
    sendEditError(res, error, 'creating fixed cost');
  }
});

// Update fixed cost
router.put('/clients/:clientId/fixed-costs/:costId', async (req, res) => {
  try {
    const { clientId, costId } = req.params;
    res.json(await edits.updateFixedCost(clientId, req.orgId, costId, req.body));
  } catch (error) {
    sendEditError(res, error, 'updating fixed cost');
  }
});

// Delete fixed cost
router.delete('/clients/:clientId/fixed-costs/:costId', async (req, res) => {
  try {
    const { clientId, costId } = req.params;
    res.json(await edits.deleteFixedCost(clientId, req.orgId, costId));
  } catch (error) {
    sendEditError(res, error, 'deleting fixed cost');
  }
});

// ─── Variable Costs CRUD ───

// Get all variable costs for a client
router.get('/clients/:clientId/variable-costs', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    res.json(await edits.listVariableCosts(clientId, req.orgId));
  } catch (error) {
    console.error('Error getting variable costs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create variable cost
router.post('/clients/:clientId/variable-costs', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    res.json(await edits.createVariableCost(clientId, req.orgId, req.body));
  } catch (error) {
    sendEditError(res, error, 'creating variable cost');
  }
});

// Update variable cost
router.put('/clients/:clientId/variable-costs/:costId', async (req, res) => {
  try {
    const { clientId, costId } = req.params;
    res.json(await edits.updateVariableCost(clientId, req.orgId, costId, req.body));
  } catch (error) {
    sendEditError(res, error, 'updating variable cost');
  }
});

// ─── Laboratorio financiero (solo clientes con lab_enabled) ───
const LAB_OWNERS = (process.env.CLIENT_PRIVACY_OWNER_EMAILS || 'juanfe@larealmarketing.com').split(',').map((e) => e.trim().toLowerCase());
const requireLab = async (req, res, next) => {
  try {
    if (!(await verifyClient(req.params.clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });
    if (!(await lab.isLabEnabled(req.params.clientId))) return res.status(403).json({ error: 'El laboratorio financiero no está habilitado para este cliente' });
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
};

router.put('/clients/:clientId/lab', async (req, res) => {
  try {
    if (!LAB_OWNERS.includes(String(req.teamMember?.email || '').toLowerCase())) return res.status(403).json({ error: 'Solo el dueño de la cuenta puede habilitar el laboratorio' });
    if (!(await verifyClient(req.params.clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });
    res.json(await lab.setLabEnabled(Number(req.params.clientId), req.orgId, Boolean(req.body?.lab_enabled)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/clients/:clientId/inventory', requireLab, async (req, res) => {
  try {
    const windowDays = [7, 14, 30, 60, 90].includes(Number(req.query.window)) ? Number(req.query.window) : 30;
    const horizonDays = [15, 30, 45, 60, 90].includes(Number(req.query.horizon)) ? Number(req.query.horizon) : 30;
    const includeHidden = req.query.include_hidden === '1' || req.query.include_hidden === 'true';
    res.json(await lab.computeInventory(Number(req.params.clientId), req.orgId, { windowDays, horizonDays, includeHidden }));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/clients/:clientId/inventory/:productId/hidden', requireLab, async (req, res) => {
  try {
    res.json(await lab.setInventoryHidden(Number(req.params.clientId), Number(req.params.productId), Boolean(req.body?.hidden)));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/clients/:clientId/inventory/sync', requireLab, async (req, res) => {
  try {
    res.json(await lab.syncInventory(Number(req.params.clientId)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/clients/:clientId/reserves', requireLab, async (req, res) => {
  try {
    const period = /^\d{4}-\d{2}$/.test(req.query.period || '') ? req.query.period : getCurrentPeriod();
    res.json(await lab.computeReserves(Number(req.params.clientId), req.orgId, period));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/clients/:clientId/reserves/providers/:provider', requireLab, async (req, res) => {
  try {
    res.json(await lab.renameReserveProvider(Number(req.params.clientId), req.orgId, decodeURIComponent(req.params.provider), req.body?.name));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/clients/:clientId/reserves/payments', requireLab, async (req, res) => {
  try {
    const { provider, period, amount, paid_at, notes } = req.body || {};
    res.json(await lab.addReservePayment({ clientId: Number(req.params.clientId), orgId: req.orgId, provider, period, amount, paidAt: paid_at, notes, createdBy: req.teamMember?.id || null }));
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/clients/:clientId/reserves/payments/:paymentId', requireLab, async (req, res) => {
  try {
    res.json(await lab.deleteReservePayment(Number(req.params.clientId), Number(req.params.paymentId)));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Escalabilidad: Break even ROAS (método Ramsés, 90 días) vs Blended ROAS en línea de tiempo. ?basis=net (sin IVA, default) | gross (con IVA)
router.get('/clients/:clientId/scalability', requireLab, async (req, res) => {
  try {
    const period = /^\d{4}-\d{2}$/.test(req.query.period || '') ? req.query.period : getCurrentPeriod();
    res.json(await getScalability({ clientId: Number(req.params.clientId), orgId: req.orgId, period, basis: normalizeBasis(req.query.basis) }));
  } catch (error) {
    console.error('Error getting scalability:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete variable cost
router.delete('/clients/:clientId/variable-costs/:costId', async (req, res) => {
  try {
    const { clientId, costId } = req.params;
    res.json(await edits.deleteVariableCost(clientId, req.orgId, costId));
  } catch (error) {
    sendEditError(res, error, 'deleting variable cost');
  }
});

// ─── Products / COGS ───

const productFromRow = (p) => ({
  ...p,
  price: p.price === null ? null : Number(p.price),
  cost: p.cost === null ? null : Number(p.cost),
  shopify_cost: p.shopify_cost === null || p.shopify_cost === undefined ? null : Number(p.shopify_cost),
});

// Catálogo sincronizado con sus costos (manual > Shopify)
router.get('/clients/:clientId/products', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const rows = await db.all(`
      SELECT id, shopify_product_id, shopify_variant_id, sku, title, variant_title, price, cost, shopify_cost,
             cost_source, image_url, status, last_synced_at
      FROM shopify_products
      WHERE client_id = $1 AND organization_id = $2
      ORDER BY title, variant_title
    `, [clientId, req.orgId]);
    const products = rows.map(productFromRow);
    const missingCost = products.filter((p) => p.cost === null).length;
    const syncedAt = products.reduce((max, p) => (p.last_synced_at && (!max || p.last_synced_at > max) ? p.last_synced_at : max), null);

    res.json({ products, missing_cost_count: missingCost, products_synced_at: syncedAt });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Costo manual de un producto (pisa el de Shopify; el COGS se recalcula en vivo)
// Costo manual para una variante vendida que NO está en el catálogo (p. ej. la tienda no dio permiso
// read_products y nunca se pudo sincronizar). Creamos la fila del producto a partir de las ventas.
router.put('/clients/:clientId/products/variant/:variantId/cost', async (req, res) => {
  try {
    const { clientId, variantId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    res.json(await edits.setVariantCost(clientId, req.orgId, variantId, req.body?.cost));
  } catch (error) {
    sendEditError(res, error, 'setting variant cost');
  }
});

router.put('/clients/:clientId/products/:productId/cost', async (req, res) => {
  try {
    const { clientId, productId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    res.json(await edits.setProductCost(clientId, req.orgId, productId, req.body?.cost));
  } catch (error) {
    sendEditError(res, error, 'updating product cost');
  }
});

// Volver al costo que está en Shopify (quita el manual)
router.delete('/clients/:clientId/products/:productId/cost', async (req, res) => {
  try {
    const { clientId, productId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    res.json(await edits.resetProductCost(clientId, req.orgId, productId));
  } catch (error) {
    sendEditError(res, error, 'resetting product cost');
  }
});

// Ajustes financieros del cliente (% de costo estimado para productos sin costo)
router.put('/clients/:clientId/settings', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });
    const rate = edits.parseCogsRate(req.body?.default_cogs_rate);
    res.json(await financials.saveFinancialSettings(clientId, req.orgId, { default_cogs_rate: rate }));
  } catch (error) {
    sendEditError(res, error, 'saving financial settings');
  }
});

// ─── Financial Dashboard (P&L + Break-even) ───
//
// GET /clients/:clientId/financials?period=YYYY-MM[&light=1]
// Si el cliente tiene Shopify: sincroniza productos (si nunca / > 24 h) y trae las ventas por
// producto que falten del mes para calcular el COGS, sin bloquear más de unos segundos.
// `light=1` solo lee lo guardado (se usa para el mes de comparación).

router.get('/clients/:clientId/financials', async (req, res) => {
  try {
    const { clientId } = req.params;
    const period = /^\d{4}-\d{2}$/.test(req.query.period || '') ? req.query.period : getCurrentPeriod();
    const light = req.query.light === '1' || req.query.light === 'true';
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const data = await financials.computeFinancials({ clientId: Number(clientId), orgId: req.orgId, period, light });
    const flags = await db.get('SELECT scenarios_enabled FROM client_portal_settings WHERE client_id = ?', [clientId]);
    res.json({ ...data, scenarios_enabled: Number(flags?.scenarios_enabled) === 1 });
  } catch (error) {
    console.error('Error getting financials:', error);
    res.status(500).json({ error: error.message });
  }
});


// ─── Palancas Dashboard (from Structured Briefs) ───

const AREA_DISPLAY_NAMES = {
  email_marketing: 'Email Marketing',
  web: 'Optimización Web',
  traffic: 'Tráfico Pago',
  design: 'Diseño',
  ugc: 'Contenido UGC',
  social: 'Redes Sociales',
  seo: 'SEO',
  crm: 'CRM',
  other: 'Otros'
};

router.get('/:clientId/palancas-dashboard', async (req, res) => {
  try {
    const { clientId } = req.params;
    const period = req.query.period || getCurrentPeriod();
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    // 1. Get structured briefs for this client in this period
    const briefs = await db.all(`
      SELECT b.id, b.title
      FROM briefs b
      WHERE b.client_id = $1
        AND b.organization_id = $2
        AND b.brief_type = 'structured'
        AND b.month = $3
    `, [clientId, req.orgId, period]);

    if (briefs.length === 0) {
      return res.json({
        areas: [],
        summary: { total_tasks: 0, completed: 0, in_progress: 0, progress_pct: 0 },
        has_brief: false
      });
    }

    const briefIds = briefs.map(b => b.id);
    const briefIdsPlaceholder = briefIds.map((_, i) => `$${i + 1}`).join(',');

    // 2. Get sections from those briefs
    const sections = await db.all(`
      SELECT bs.*, tm.name as responsible_name
      FROM brief_sections bs
      LEFT JOIN team_members tm ON bs.responsible_id = tm.id
      WHERE bs.brief_id IN (${briefIdsPlaceholder})
      ORDER BY bs.area_key, bs.order_index
    `, briefIds);

    // 3. Get tasks with real status (linked via generated_task_id)
    const tasks = await db.all(`
      SELECT
        bst.id,
        bst.title,
        bst.description,
        bst.due_date,
        bst.priority,
        bst.section_id,
        bs.area_key,
        COALESCE(t.status, 'todo') as task_status,
        t.id as real_task_id
      FROM brief_section_tasks bst
      JOIN brief_sections bs ON bst.section_id = bs.id
      LEFT JOIN tasks t ON bst.generated_task_id = t.id
      WHERE bs.brief_id IN (${briefIdsPlaceholder})
      ORDER BY bst.order_index
    `, briefIds);

    // 4. Group by area_key
    const areaMap = {};

    for (const section of sections) {
      const areaKey = section.area_key || 'other';
      if (!areaMap[areaKey]) {
        areaMap[areaKey] = {
          area_key: areaKey,
          area_name: section.area_name || AREA_DISPLAY_NAMES[areaKey] || areaKey,
          context: section.context_text,
          responsible: section.responsible_id ? {
            id: section.responsible_id,
            name: section.responsible_name
          } : null,
          tasks: [],
          stats: { total: 0, done: 0, in_progress: 0, todo: 0, blocked: 0 }
        };
      } else if (section.context_text && !areaMap[areaKey].context) {
        // Use first non-empty context
        areaMap[areaKey].context = section.context_text;
      }
      // If section has a responsible and area doesn't, use it
      if (section.responsible_id && !areaMap[areaKey].responsible) {
        areaMap[areaKey].responsible = {
          id: section.responsible_id,
          name: section.responsible_name
        };
      }
    }

    // 5. Add tasks to each area
    for (const task of tasks) {
      const areaKey = task.area_key || 'other';
      const area = areaMap[areaKey];
      if (!area) continue;

      const status = task.task_status || 'todo';
      area.tasks.push({
        id: task.id,
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        priority: task.priority,
        status: status,
        real_task_id: task.real_task_id
      });
      area.stats.total++;
      area.stats[status] = (area.stats[status] || 0) + 1;
    }

    const areas = Object.values(areaMap);

    // Calculate summary
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.task_status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.task_status === 'in_progress').length;

    const summary = {
      total_tasks: totalTasks,
      completed: completedTasks,
      in_progress: inProgressTasks,
      progress_pct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };

    res.json({ areas, summary, has_brief: true });
  } catch (error) {
    console.error('Error getting palancas dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Products Sync from Shopify ───

router.post('/clients/:clientId/products/sync', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    res.json(await edits.syncProductsForClient(clientId, req.orgId));
  } catch (error) {
    sendEditError(res, error, 'syncing products');
  }
});

// ─── Recalcular ventas por producto / COGS de un rango (manual) ───

router.post('/clients/:clientId/cogs/calculate', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { start_date, end_date } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end_date || '') || start_date > end_date) {
      return res.status(400).json({ error: 'start_date y end_date (YYYY-MM-DD) son requeridos' });
    }
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const cred = await financials.getShopifyCredentials(clientId);
    if (!cred) return res.status(400).json({ error: 'Sin conexión Shopify activa' });

    const today = financials.todayColombia();
    const end = end_date > today ? today : end_date;
    const result = await financials.syncProductSalesRange(Number(clientId), req.orgId, start_date, end);
    res.json({ success: true, period: { start_date, end_date: end }, days_calculated: result.days, product_rows: result.rows });
  } catch (error) {
    console.error('Error calculating COGS:', error);
    res.status(500).json({ error: error.message });
  }
});


// ─── Exportar el dashboard financiero a Excel (.xlsx) ───

router.get('/clients/:clientId/financials/export.xlsx', async (req, res) => {
  try {
    const { clientId } = req.params;
    const period = /^\d{4}-\d{2}$/.test(req.query.period || '') ? req.query.period : getCurrentPeriod();
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const brand = await getClientBrandName(Number(clientId), req.orgId);
    const buffer = await buildFinancialsWorkbook({ clientId: Number(clientId), orgId: req.orgId, period, brand });
    const filename = financialsExportFilename(brand, period);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting financials to Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Rellenar descuentos (sin IVA) de un rango: solo la columna shopify_discounts_net ───

router.post('/clients/:clientId/discounts/backfill', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { start_date, end_date } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end_date || '') || start_date > end_date) {
      return res.status(400).json({ error: 'start_date y end_date (YYYY-MM-DD) son requeridos' });
    }
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const result = await backfillDiscounts(Number(clientId), start_date, end_date);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error backfilling discounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Escenarios financieros ("¿qué pasa si…?") guardados, privados o compartidos ───
// Owner = quien está logueado en el equipo. Privado → solo lo ve/edita su dueño.

const scenarioOwner = (req) => ({ owner_type: 'team', owner_id: req.teamMember?.id });
const scenarioPeriod = (v) => (/^\d{4}-\d{2}$/.test(v || '') ? v : getCurrentPeriod());
const requireScenarioClient = async (req, res, next) => {
  try {
    if (!(await verifyClient(req.params.clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });
    if (!req.teamMember?.id) return res.status(401).json({ error: 'Sesión de equipo requerida' });
    // Los escenarios se habilitan por cliente (Plataformas → Finanzas en el portal → Escenarios financieros)
    const flags = await db.get('SELECT scenarios_enabled FROM client_portal_settings WHERE client_id = ?', [req.params.clientId]);
    if (Number(flags?.scenarios_enabled) !== 1) return res.status(403).json({ error: 'Los escenarios financieros no están habilitados para este cliente', scenarios_disabled: true });
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
};
const scenarioError = (res, error, fallback) => {
  console.error(fallback, error);
  res.status(error.status || 500).json({ error: error.message });
};

router.get('/clients/:clientId/scenarios', requireScenarioClient, async (req, res) => {
  try {
    const withResults = !(req.query.light === '1' || req.query.light === 'true');
    res.json(await scenarios.listScenarios({ clientId: Number(req.params.clientId), orgId: req.orgId, owner: scenarioOwner(req), period: scenarioPeriod(req.query.period), withResults }));
  } catch (error) { scenarioError(res, error, 'Error listing scenarios:'); }
});

// Antes de /:id para que "compare" no se tome como id
router.get('/clients/:clientId/scenarios/compare', requireScenarioClient, async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').map((x) => x.trim()).filter(Boolean);
    res.json(await scenarios.compareScenarios({ clientId: Number(req.params.clientId), orgId: req.orgId, owner: scenarioOwner(req), ids, period: scenarioPeriod(req.query.period) }));
  } catch (error) { scenarioError(res, error, 'Error comparing scenarios:'); }
});

router.post('/clients/:clientId/scenarios/evaluate', requireScenarioClient, async (req, res) => {
  try {
    const { params, period } = req.body || {};
    res.json(await scenarios.evaluateScenario({ clientId: Number(req.params.clientId), orgId: req.orgId, period: scenarioPeriod(period || req.query.period), params: params || {} }));
  } catch (error) { scenarioError(res, error, 'Error evaluating scenario:'); }
});

router.get('/clients/:clientId/scenarios/:id', requireScenarioClient, async (req, res) => {
  try {
    const s = await scenarios.getScenario({ clientId: Number(req.params.clientId), orgId: req.orgId, id: Number(req.params.id), owner: scenarioOwner(req) });
    if (!s) return res.status(404).json({ error: 'Escenario no encontrado' });
    res.json(s);
  } catch (error) { scenarioError(res, error, 'Error getting scenario:'); }
});

router.post('/clients/:clientId/scenarios', requireScenarioClient, async (req, res) => {
  try {
    const { name, description, visibility, params, period } = req.body || {};
    const s = await scenarios.createScenario({ clientId: Number(req.params.clientId), orgId: req.orgId, owner: scenarioOwner(req), name, description, visibility, params, period });
    res.status(201).json(s);
  } catch (error) { scenarioError(res, error.status ? error : Object.assign(error, { status: 400 }), 'Error creating scenario:'); }
});

router.put('/clients/:clientId/scenarios/:id', requireScenarioClient, async (req, res) => {
  try {
    const { name, description, visibility, params, period } = req.body || {};
    const s = await scenarios.updateScenario({ clientId: Number(req.params.clientId), orgId: req.orgId, id: Number(req.params.id), owner: scenarioOwner(req), name, description, visibility, params, period });
    if (!s) return res.status(404).json({ error: 'Escenario no encontrado' });
    res.json(s);
  } catch (error) { scenarioError(res, error.status ? error : Object.assign(error, { status: 400 }), 'Error updating scenario:'); }
});

router.delete('/clients/:clientId/scenarios/:id', requireScenarioClient, async (req, res) => {
  try {
    const ok = await scenarios.deleteScenario({ clientId: Number(req.params.clientId), orgId: req.orgId, id: Number(req.params.id), owner: scenarioOwner(req) });
    if (!ok) return res.status(404).json({ error: 'Escenario no encontrado' });
    res.json({ success: true });
  } catch (error) { scenarioError(res, error, 'Error deleting scenario:'); }
});

// ─── Cuándo compran / nuevos vs recurrentes (libro de pedidos client_orders) ───
// Si el libro está vacío, el GET arranca el histórico en segundo plano y responde { building: true }.

router.get('/clients/:clientId/patterns', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });
    const state = await orderLedger.ensureLedger(Number(clientId), req.orgId);
    if (!state.ready) return res.json({ building: state.building, empty: !state.building, no_store: Boolean(state.no_store) });
    const data = await orderLedger.getPatterns(Number(clientId), req.orgId, { days: Number(req.query.days) || 90 });
    res.json(data);
  } catch (error) {
    console.error('Error fetching purchase patterns:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clients/:clientId/customer-mix', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });
    const state = await orderLedger.ensureLedger(Number(clientId), req.orgId);
    if (!state.ready) return res.json({ building: state.building, empty: !state.building, no_store: Boolean(state.no_store) });
    const data = await orderLedger.getCustomerMix(Number(clientId), req.orgId, { start: req.query.start, end: req.query.end });
    res.json(data);
  } catch (error) {
    console.error('Error fetching customer mix:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/clients/:clientId/orders/backfill', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });
    const cred = await financials.getShopifyCredentials(clientId);
    if (!cred) return res.status(400).json({ error: 'Sin tienda conectada (Shopify o WooCommerce)' });
    const days = Math.max(7, Math.min(Number(req.body?.days) || 180, 730));
    const already = orderLedger.isBackfilling(clientId);
    orderLedger.startBackfill(Number(clientId), req.orgId, days);
    res.json({ started: !already, building: true, days });
  } catch (error) {
    console.error('Error starting orders backfill:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
