// [billing] Cobro del plan de la organización actual con Bold (o transferencia).
// Montado en /api/org/billing (teamAuth). Todas las rutas son solo para admins.
//
//   POST /api/org/billing/checkout  { plan, cycle }  → link de Bold o instrucciones manuales
//   GET  /api/org/billing/payments                   → pagos de la organización
//   GET  /api/org/billing/status?reference=          → estado de un pago (pantalla de retorno)
//   GET  /api/org/billing/quote?plan=&cycle=         → cotización sin crear nada
import express from 'express';
import db from '../config/database.js';
import { requireAdmin } from '../middleware/teamAuth.js';
import { getOrgPlan } from '../services/plans.js';
import {
  quote,
  createCheckout,
  listPayments,
  getPaymentByReference,
  publicPayment,
  reconcilePendingPayment,
} from '../services/billing.js';

const router = express.Router();
router.use(requireAdmin);

const userEmail = (req) => req.user?.email || req.teamMember?.email || null;

router.get('/quote', (req, res) => {
  try {
    res.json(quote(req.query.plan, req.query.cycle));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const { plan, cycle } = req.body || {};
    const org = await db.get('SELECT id, name FROM organizations WHERE id = ?', [req.orgId]);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const result = await createCheckout({
      orgId: req.orgId,
      orgName: org.name,
      plan,
      cycle,
      payerEmail: userEmail(req),
    });
    console.log(`[billing] checkout org ${req.orgId}: ${result.plan} ${result.cycle} ${result.total} COP vía ${result.provider} (${result.reference}) por ${userEmail(req) || 'desconocido'}`);

    // Dejamos registrada la intención de plan (como hacía PUT /org/plan)
    await db.run(
      `UPDATE organizations SET plan_selected = ?, plan_requested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [result.plan, req.orgId]
    ).catch(() => {});

    res.status(201).json(result);
  } catch (error) {
    console.error('[billing] POST /org/billing/checkout:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'No se pudo iniciar el pago' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const rows = await listPayments(req.orgId, req.query.limit);
    res.json({ payments: rows.map(publicPayment) });
  } catch (error) {
    console.error('[billing] GET /org/billing/payments:', error.message);
    res.status(500).json({ error: 'Error al consultar los pagos' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const reference = String(req.query.reference || '').trim();
    if (!reference) return res.status(400).json({ error: 'Falta la referencia' });
    let payment = await getPaymentByReference(reference, req.orgId);
    if (!payment) return res.status(404).json({ error: 'Pago no encontrado' });
    payment = await reconcilePendingPayment(payment);
    const plan = await getOrgPlan(req.orgId, { withUsage: false });
    res.json({
      payment: publicPayment(payment),
      plan: plan ? {
        plan: plan.plan, plan_name: plan.plan_name, status: plan.status, billing_cycle: plan.billing_cycle,
        plan_renews_at: plan.plan_renews_at, price_locked_until: plan.price_locked_until,
        addons: plan.addons, addons_included: plan.addons_included,
      } : null,
    });
  } catch (error) {
    console.error('[billing] GET /org/billing/status:', error.message);
    res.status(500).json({ error: 'Error al consultar el pago' });
  }
});

export default router;
