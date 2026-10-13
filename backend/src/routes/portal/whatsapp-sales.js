/**
 * Portal del cliente: registrar sus ventas por WhatsApp (el cliente reporta lo que vendió por chat).
 * Montado en /api/portal/whatsapp-sales (clientAuth + can_view_metrics).
 */
import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';
import { listWhatsappSales, upsertWhatsappSale, distributeWhatsappSales, deleteWhatsappSale, channelSummary } from '../../services/whatsappSales.js';

const router = express.Router();
const guard = [clientAuthMiddleware, requirePortalPermission('can_view_metrics')];

const range = (q) => {
  const start = String(q.start_date || q.startDate || '').slice(0, 10);
  const end = String(q.end_date || q.endDate || '').slice(0, 10);
  return start && end ? { start, end } : null;
};

router.get('/', ...guard, async (req, res) => {
  try {
    const clientId = req.client.id;
    const r = range(req.query) || (() => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      return { start: `${today.slice(0, 7)}-01`, end: today };
    })();
    const [sales, summary] = await Promise.all([listWhatsappSales(clientId, r.start, r.end), channelSummary(clientId, r.start, r.end)]);
    res.json({ period: r, sales, summary: { whatsapp_revenue: summary.whatsapp_revenue, whatsapp_orders: summary.whatsapp_orders } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', ...guard, async (req, res) => {
  try {
    const clientId = req.client.id;
    const org = await db.get('SELECT organization_id FROM clients WHERE id = ?', [clientId]);
    const { date, revenue, orders, notes, start_date, end_date } = req.body || {};
    if (start_date && end_date) {
      const r = await distributeWhatsappSales({ clientId, orgId: org?.organization_id, start: start_date, end: end_date, revenue, orders, notes, source: 'portal' });
      return res.json(r);
    }
    if (!date || revenue === undefined) return res.status(400).json({ error: 'date y revenue son requeridos' });
    res.json(await upsertWhatsappSale({ clientId, orgId: org?.organization_id, date, revenue, orders, notes, source: 'portal' }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:date', ...guard, async (req, res) => {
  try {
    res.json(await deleteWhatsappSale(req.client.id, req.params.date));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
