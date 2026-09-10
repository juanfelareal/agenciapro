import express from 'express';
import db from '../config/database.js';
import ShopifyIntegration from '../integrations/shopify.js';

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
    res.json(client || { commission_rate: 0, commission_deduction: 0, commission_threshold: 0, commission_rate_above: 0 });
  } catch (error) {
    console.error('Error getting commission settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get growth clients with metrics summary
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

    const [objectives, palancas, milestones, banderas] = await Promise.all([
      db.all('SELECT * FROM growth_objectives WHERE client_id = $1 AND period = $2 AND organization_id = $3', [clientId, period, req.orgId]),
      db.all('SELECT * FROM growth_palancas WHERE client_id = $1 AND period = $2 AND organization_id = $3 ORDER BY rank ASC', [clientId, period, req.orgId]),
      db.all('SELECT * FROM growth_milestones WHERE client_id = $1 AND period = $2 AND organization_id = $3', [clientId, period, req.orgId]),
      db.all('SELECT * FROM growth_banderas WHERE client_id = $1 AND period = $2 AND organization_id = $3 AND is_active = 1', [clientId, period, req.orgId]),
    ]);

    res.json({ objectives, palancas, milestones, banderas });
  } catch (error) {
    console.error('Error getting growth data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Objectives CRUD ───

router.post('/:clientId/objectives', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period, metric, conservador, base, optimista } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    // Upsert: delete existing + insert
    await db.run('DELETE FROM growth_objectives WHERE client_id = $1 AND period = $2 AND metric = $3 AND organization_id = $4', [clientId, period, metric, req.orgId]);
    const result = await db.run(`
      INSERT INTO growth_objectives (client_id, period, metric, conservador, base, optimista, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [clientId, period, metric, conservador || 0, base || 0, optimista || 0, req.orgId]);

    res.json({ id: result.lastID, client_id: clientId, period, metric, conservador, base, optimista });
  } catch (error) {
    console.error('Error creating objective:', error);
    res.status(500).json({ error: error.message });
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

    const costs = await db.all(`
      SELECT * FROM client_fixed_costs
      WHERE client_id = $1 AND organization_id = $2
      ORDER BY category, name
    `, [clientId, req.orgId]);

    res.json(costs);
  } catch (error) {
    console.error('Error getting fixed costs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create fixed cost
router.post('/clients/:clientId/fixed-costs', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { category, name, amount, start_date, end_date, notes } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    if (!category || !name || amount === undefined || !start_date) {
      return res.status(400).json({ error: 'category, name, amount, and start_date are required' });
    }

    const result = await db.run(`
      INSERT INTO client_fixed_costs (organization_id, client_id, category, name, amount, start_date, end_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [req.orgId, clientId, category, name, amount, start_date, end_date || null, notes || null]);

    res.json({ id: result.lastID, category, name, amount, start_date, end_date, notes });
  } catch (error) {
    console.error('Error creating fixed cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update fixed cost
router.put('/clients/:clientId/fixed-costs/:costId', async (req, res) => {
  try {
    const { clientId, costId } = req.params;
    const { category, name, amount, start_date, end_date, notes } = req.body;

    await db.run(`
      UPDATE client_fixed_costs
      SET category = $1, name = $2, amount = $3, start_date = $4, end_date = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND client_id = $8 AND organization_id = $9
    `, [category, name, amount, start_date, end_date || null, notes || null, costId, clientId, req.orgId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating fixed cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete fixed cost
router.delete('/clients/:clientId/fixed-costs/:costId', async (req, res) => {
  try {
    const { clientId, costId } = req.params;
    await db.run('DELETE FROM client_fixed_costs WHERE id = $1 AND client_id = $2 AND organization_id = $3', [costId, clientId, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting fixed cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Variable Costs CRUD ───

// Get all variable costs for a client
router.get('/clients/:clientId/variable-costs', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const costs = await db.all(`
      SELECT * FROM client_variable_costs
      WHERE client_id = $1 AND organization_id = $2
      ORDER BY category, name
    `, [clientId, req.orgId]);

    res.json(costs);
  } catch (error) {
    console.error('Error getting variable costs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create variable cost
router.post('/clients/:clientId/variable-costs', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { category, name, percentage, applies_to, notes } = req.body;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    if (!category || !name || percentage === undefined) {
      return res.status(400).json({ error: 'category, name, and percentage are required' });
    }

    const result = await db.run(`
      INSERT INTO client_variable_costs (organization_id, client_id, category, name, percentage, applies_to, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [req.orgId, clientId, category, name, percentage, applies_to || 'revenue', notes || null]);

    res.json({ id: result.lastID, category, name, percentage, applies_to: applies_to || 'revenue', notes });
  } catch (error) {
    console.error('Error creating variable cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update variable cost
router.put('/clients/:clientId/variable-costs/:costId', async (req, res) => {
  try {
    const { clientId, costId } = req.params;
    const { category, name, percentage, applies_to, is_active, notes } = req.body;

    await db.run(`
      UPDATE client_variable_costs
      SET category = $1, name = $2, percentage = $3, applies_to = $4, is_active = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND client_id = $8 AND organization_id = $9
    `, [category, name, percentage, applies_to || 'revenue', is_active ?? 1, notes || null, costId, clientId, req.orgId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating variable cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete variable cost
router.delete('/clients/:clientId/variable-costs/:costId', async (req, res) => {
  try {
    const { clientId, costId } = req.params;
    await db.run('DELETE FROM client_variable_costs WHERE id = $1 AND client_id = $2 AND organization_id = $3', [costId, clientId, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting variable cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Products / COGS ───

// Get products with costs for a client
router.get('/clients/:clientId/products', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    const products = await db.all(`
      SELECT * FROM shopify_products
      WHERE client_id = $1 AND organization_id = $2
      ORDER BY title
    `, [clientId, req.orgId]);

    // Count products without cost
    const missingCost = products.filter(p => !p.cost || p.cost === 0).length;

    res.json({ products, missing_cost_count: missingCost });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update product cost manually
router.put('/clients/:clientId/products/:productId/cost', async (req, res) => {
  try {
    const { clientId, productId } = req.params;
    const { cost } = req.body;

    await db.run(`
      UPDATE shopify_products
      SET cost = $1, cost_source = 'manual', updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND client_id = $3 AND organization_id = $4
    `, [cost, productId, clientId, req.orgId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating product cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Financial Dashboard (P&L + Break-even) ───

router.get('/clients/:clientId/financials', async (req, res) => {
  try {
    const { clientId } = req.params;
    const period = req.query.period || getCurrentPeriod(); // YYYY-MM
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Client not found' });

    // Parse period
    const [year, month] = period.split('-').map(Number);
    const startDate = `${period}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;

    // Get end date for queries
    const endDate = isCurrentMonth
      ? `${period}-${String(today.getDate()).padStart(2, '0')}`
      : `${period}-${String(daysInMonth).padStart(2, '0')}`;

    // 1. Revenue from daily_shopify_metrics
    const revenueData = await db.get(`
      SELECT
        COALESCE(SUM(shopify_net_revenue), 0) as revenue_mtd,
        COALESCE(SUM(shopify_orders), 0) as orders_mtd
      FROM daily_shopify_metrics
      WHERE client_id = $1 AND organization_id = $2
        AND date >= $3 AND date <= $4
    `, [clientId, req.orgId, startDate, endDate]);

    const revenueMTD = revenueData?.revenue_mtd || 0;
    const ordersMTD = revenueData?.orders_mtd || 0;
    const dailyAvgRevenue = daysElapsed > 0 ? revenueMTD / daysElapsed : 0;
    const projectedRevenue = dailyAvgRevenue * daysInMonth;

    // 2. Ad spend from daily_marketing_metrics
    const adSpendData = await db.get(`
      SELECT
        COALESCE(SUM(fb_spend), 0) + COALESCE(SUM(ga_spend), 0) + COALESCE(SUM(tt_spend), 0) as ad_spend_mtd
      FROM daily_marketing_metrics
      WHERE client_id = $1 AND organization_id = $2
        AND date >= $3 AND date <= $4
    `, [clientId, req.orgId, startDate, endDate]);

    const adSpendMTD = adSpendData?.ad_spend_mtd || 0;
    const roas = adSpendMTD > 0 ? revenueMTD / adSpendMTD : 0;

    // 3. COGS from daily_cogs
    const cogsData = await db.get(`
      SELECT
        COALESCE(SUM(total_cogs), 0) as cogs_mtd,
        COALESCE(SUM(units_sold), 0) as units_sold
      FROM daily_cogs
      WHERE client_id = $1 AND organization_id = $2
        AND date >= $3 AND date <= $4
    `, [clientId, req.orgId, startDate, endDate]);

    const cogsMTD = cogsData?.cogs_mtd || 0;
    const cogsMarginPct = revenueMTD > 0 ? ((revenueMTD - cogsMTD) / revenueMTD) * 100 : 0;

    // 4. Gross profit
    const grossProfitMTD = revenueMTD - cogsMTD;
    const grossMarginPct = revenueMTD > 0 ? (grossProfitMTD / revenueMTD) * 100 : 0;

    // 5. Fixed costs (active for this period)
    const fixedCosts = await db.all(`
      SELECT id, category, name, amount
      FROM client_fixed_costs
      WHERE client_id = $1 AND organization_id = $2
        AND start_date <= $3
        AND (end_date IS NULL OR end_date >= $4)
      ORDER BY category, name
    `, [clientId, req.orgId, endDate, startDate]);

    const fixedCostsMonthlyTotal = fixedCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
    const fixedCostsMTDProrated = (fixedCostsMonthlyTotal / daysInMonth) * daysElapsed;

    // 6. Variable costs
    const variableCosts = await db.all(`
      SELECT id, category, name, percentage, applies_to
      FROM client_variable_costs
      WHERE client_id = $1 AND organization_id = $2 AND is_active = 1
      ORDER BY category, name
    `, [clientId, req.orgId]);

    let variableCostsMTD = 0;
    const variableCostsBreakdown = variableCosts.map(vc => {
      const baseAmount = vc.applies_to === 'net_revenue' ? (revenueMTD - cogsMTD) : revenueMTD;
      const amount = (baseAmount * (vc.percentage || 0)) / 100;
      variableCostsMTD += amount;
      return {
        id: vc.id,
        name: vc.name,
        category: vc.category,
        percentage: vc.percentage,
        amount
      };
    });

    // 7. Net profit
    const netProfitMTD = grossProfitMTD - adSpendMTD - fixedCostsMTDProrated - variableCostsMTD;
    const netMarginPct = revenueMTD > 0 ? (netProfitMTD / revenueMTD) * 100 : 0;
    const dailyAvgNetProfit = daysElapsed > 0 ? netProfitMTD / daysElapsed : 0;
    const projectedNetProfit = dailyAvgNetProfit * daysInMonth;

    // 8. Break-even calculation
    // Contribution margin = 1 - (COGS% + Variable costs%)
    const cogsPct = revenueMTD > 0 ? cogsMTD / revenueMTD : 0;
    const variableCostsPct = variableCosts.reduce((sum, vc) => {
      if (vc.applies_to === 'net_revenue') {
        return sum + ((vc.percentage || 0) / 100) * (1 - cogsPct);
      }
      return sum + ((vc.percentage || 0) / 100);
    }, 0);

    const contributionMargin = 1 - cogsPct - variableCostsPct;

    // Fixed costs remaining = total monthly - prorated MTD
    const fixedCostsRemaining = fixedCostsMonthlyTotal - fixedCostsMTDProrated;

    // Also need to cover ad spend projection for remaining days
    const dailyAvgAdSpend = daysElapsed > 0 ? adSpendMTD / daysElapsed : 0;
    const adSpendRemaining = dailyAvgAdSpend * (daysInMonth - daysElapsed);
    const totalFixedRemaining = fixedCostsRemaining + adSpendRemaining;

    // Revenue needed to break even on remaining fixed costs
    const revenueToBreakeven = contributionMargin > 0 ? totalFixedRemaining / contributionMargin : 0;
    const daysToBreakeven = dailyAvgRevenue > 0 ? revenueToBreakeven / dailyAvgRevenue : 0;
    const willBeProfitable = projectedNetProfit > 0;

    // 9. Products summary
    const productsData = await db.get(`
      SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN cost IS NULL OR cost = 0 THEN 1 ELSE 0 END) as missing_cost_count
      FROM shopify_products
      WHERE client_id = $1 AND organization_id = $2
    `, [clientId, req.orgId]);

    res.json({
      period,
      days_in_month: daysInMonth,
      days_elapsed: daysElapsed,

      revenue: {
        mtd: revenueMTD,
        daily_avg: dailyAvgRevenue,
        projected_eom: projectedRevenue,
        orders_mtd: ordersMTD
      },

      cogs: {
        mtd: cogsMTD,
        margin_pct: cogsMarginPct,
        units_sold: cogsData?.units_sold || 0
      },

      gross_profit: {
        mtd: grossProfitMTD,
        margin_pct: grossMarginPct
      },

      ad_spend: {
        mtd: adSpendMTD,
        daily_avg: dailyAvgAdSpend,
        roas
      },

      fixed_costs: {
        monthly_total: fixedCostsMonthlyTotal,
        mtd_prorated: fixedCostsMTDProrated,
        breakdown: fixedCosts.map(fc => ({
          id: fc.id,
          name: fc.name,
          category: fc.category,
          amount: fc.amount
        }))
      },

      variable_costs: {
        mtd: variableCostsMTD,
        breakdown: variableCostsBreakdown
      },

      net_profit: {
        mtd: netProfitMTD,
        margin_pct: netMarginPct,
        daily_avg: dailyAvgNetProfit,
        projected_eom: projectedNetProfit
      },

      breakeven: {
        fixed_costs_remaining: fixedCostsRemaining,
        ad_spend_remaining: adSpendRemaining,
        contribution_margin: contributionMargin,
        revenue_to_breakeven: revenueToBreakeven,
        days_to_breakeven: daysToBreakeven,
        will_be_profitable: willBeProfitable
      },

      products: {
        total: productsData?.total_products || 0,
        missing_cost: productsData?.missing_cost_count || 0
      }
    });
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
    if (!(await verifyClient(clientId, req.orgId))) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get Shopify credentials
    const shopifyCred = await db.get(
      'SELECT store_url, access_token FROM client_shopify_credentials WHERE client_id = $1 AND status = $2',
      [clientId, 'active']
    );

    if (!shopifyCred || !shopifyCred.store_url || !shopifyCred.access_token) {
      return res.status(400).json({ error: 'Sin conexión Shopify activa' });
    }

    const shopify = new ShopifyIntegration(shopifyCred.store_url, shopifyCred.access_token);
    const products = await shopify.getProductsWithCosts();

    // Upsert products into shopify_products table
    let synced = 0;
    let withoutCost = 0;

    for (const product of products) {
      await db.run(`
        INSERT INTO shopify_products (
          organization_id, client_id, shopify_product_id, shopify_variant_id,
          sku, title, variant_title, price, cost, cost_source, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'shopify', datetime('now'))
        ON CONFLICT (client_id, shopify_variant_id) DO UPDATE SET
          shopify_product_id = EXCLUDED.shopify_product_id,
          sku = EXCLUDED.sku,
          title = EXCLUDED.title,
          variant_title = EXCLUDED.variant_title,
          price = EXCLUDED.price,
          cost = CASE WHEN shopify_products.cost_source = 'manual' THEN shopify_products.cost ELSE EXCLUDED.cost END,
          last_synced_at = datetime('now'),
          updated_at = datetime('now')
      `, [
        req.orgId, clientId, product.shopify_product_id, product.shopify_variant_id,
        product.sku, product.title, product.variant_title, product.price, product.cost
      ]);

      synced++;
      if (product.cost === null) withoutCost++;
    }

    res.json({
      success: true,
      synced,
      without_cost: withoutCost,
      message: `Sincronizados ${synced} productos. ${withoutCost} sin costo definido.`
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Calculate COGS for a Period ───

router.post('/clients/:clientId/cogs/calculate', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { start_date, end_date } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    }

    if (!(await verifyClient(clientId, req.orgId))) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get Shopify credentials
    const shopifyCred = await db.get(
      'SELECT store_url, access_token FROM client_shopify_credentials WHERE client_id = $1 AND status = $2',
      [clientId, 'active']
    );

    if (!shopifyCred || !shopifyCred.store_url || !shopifyCred.access_token) {
      return res.status(400).json({ error: 'Sin conexión Shopify activa' });
    }

    // Get product costs from our database (combines Shopify + manual overrides)
    const products = await db.all(
      'SELECT shopify_variant_id, cost FROM shopify_products WHERE client_id = $1 AND cost IS NOT NULL',
      [clientId]
    );

    const productCostMap = {};
    for (const p of products) {
      productCostMap[p.shopify_variant_id] = p.cost;
    }

    if (Object.keys(productCostMap).length === 0) {
      return res.status(400).json({
        error: 'No hay productos con costos configurados. Sincroniza productos primero.'
      });
    }

    // Calculate COGS using Shopify integration
    const shopify = new ShopifyIntegration(shopifyCred.store_url, shopifyCred.access_token);
    const cogsResult = await shopify.calculateCOGS(start_date, end_date, productCostMap);

    // Save daily COGS to database
    for (const day of cogsResult.dailyCogs) {
      await db.run(`
        INSERT INTO daily_cogs (organization_id, client_id, date, total_cogs, units_sold, orders_count, calculated_at)
        VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))
        ON CONFLICT (client_id, date) DO UPDATE SET
          total_cogs = EXCLUDED.total_cogs,
          units_sold = EXCLUDED.units_sold,
          orders_count = EXCLUDED.orders_count,
          calculated_at = datetime('now')
      `, [req.orgId, clientId, day.date, day.cogs, day.units, day.orders]);
    }

    res.json({
      success: true,
      period: { start_date, end_date },
      total_cogs: cogsResult.totalCogs,
      total_units: cogsResult.totalUnits,
      days_calculated: cogsResult.dailyCogs.length,
      products_without_cost: cogsResult.productsWithoutCost
    });
  } catch (error) {
    console.error('Error calculating COGS:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Get Products List ───

router.get('/clients/:clientId/products', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const products = await db.all(`
      SELECT id, shopify_product_id, shopify_variant_id, sku, title, variant_title,
             price, cost, cost_source, last_synced_at
      FROM shopify_products
      WHERE client_id = $1 AND organization_id = $2
      ORDER BY title, variant_title
    `, [clientId, req.orgId]);

    res.json(products);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Update Product Cost (Manual Override) ───

router.put('/clients/:clientId/products/:productId/cost', async (req, res) => {
  try {
    const { clientId, productId } = req.params;
    const { cost } = req.body;

    if (cost === undefined || cost === null) {
      return res.status(400).json({ error: 'cost es requerido' });
    }

    if (!(await verifyClient(clientId, req.orgId))) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const result = await db.run(`
      UPDATE shopify_products
      SET cost = $1, cost_source = 'manual', updated_at = datetime('now')
      WHERE id = $2 AND client_id = $3 AND organization_id = $4
    `, [parseFloat(cost), productId, clientId, req.orgId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating product cost:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
