/**
 * Ventas por WhatsApp (equipo): registro diario, reparto de totales, campañas por canal.
 * Montado en /api/whatsapp-sales (teamAuth).
 */
import express from 'express';
import db from '../config/database.js';
import { getClientRevenueMetric, pickDisplayRevenue } from '../utils/revenueMetric.js';
import {
  listWhatsappSales, upsertWhatsappSale, distributeWhatsappSales, deleteWhatsappSale,
  channelSummary, getCampaignChannels, setCampaignChannel, recalcWhatsappSpend, isWhatsappSalesEnabled,
} from '../services/whatsappSales.js';

const router = express.Router();

const ownClient = async (req, res, next) => {
  const client = await db.get('SELECT id, name, company, nickname FROM clients WHERE id = ? AND organization_id = ?', [req.params.clientId, req.orgId]);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  req.client = client;
  req.whatsappSalesEnabled = await isWhatsappSalesEnabled(client.id);
  next();
};

// Escrituras y consultas a Meta solo si el canal está habilitado para el cliente
const requireEnabled = (req, res, next) => {
  if (!req.whatsappSalesEnabled) return res.status(403).json({ error: 'El canal de ventas por WhatsApp no está habilitado para este cliente. Actívalo en Configuración del cliente.' });
  next();
};

const range = (q) => {
  const start = String(q.start_date || q.start || '').slice(0, 10);
  const end = String(q.end_date || q.end || '').slice(0, 10);
  if (!start || !end) return null;
  return { start, end };
};

/** GET /:clientId?start_date&end_date → ventas registradas + resumen por canal */
router.get('/:clientId', ownClient, async (req, res) => {
  try {
    const r = range(req.query);
    if (!r) return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    const metric = await getClientRevenueMetric(db, req.client.id);
    const store = await db.get(`
      SELECT COALESCE(SUM(shopify_revenue),0) AS total, COALESCE(SUM(shopify_net_revenue),0) AS net, COALESCE(SUM(shopify_all_orders_revenue),0) AS all_orders,
             COALESCE(SUM(shopify_orders),0) AS orders
      FROM client_daily_metrics WHERE client_id = ? AND metric_date BETWEEN ? AND ?
    `, [req.client.id, r.start, r.end]);
    const storeRevenue = pickDisplayRevenue(metric, { total: store?.total, net: store?.net, allOrders: store?.all_orders });
    const [sales, summary] = await Promise.all([
      listWhatsappSales(req.client.id, r.start, r.end),
      channelSummary(req.client.id, r.start, r.end, { storeRevenue }),
    ]);
    res.json({ enabled: req.whatsappSalesEnabled, sales, summary: { ...summary, web_orders: Number(store?.orders) || 0 }, revenue_metric: metric });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /:clientId  { date, revenue, orders, notes } */
router.post('/:clientId', ownClient, requireEnabled, async (req, res) => {
  try {
    const { date, revenue, orders, notes } = req.body || {};
    if (!date || revenue === undefined) return res.status(400).json({ error: 'date y revenue son requeridos' });
    const r = await upsertWhatsappSale({ clientId: req.client.id, orgId: req.orgId, date, revenue, orders, notes, source: 'orbit', createdBy: req.teamMember?.id || null });
    res.json(r);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /:clientId/bulk  { start_date, end_date, revenue, orders, notes } → reparte parejo */
router.post('/:clientId/bulk', ownClient, requireEnabled, async (req, res) => {
  try {
    const { start_date, end_date, revenue, orders, notes } = req.body || {};
    if (!start_date || !end_date || revenue === undefined) return res.status(400).json({ error: 'start_date, end_date y revenue son requeridos' });
    const r = await distributeWhatsappSales({ clientId: req.client.id, orgId: req.orgId, start: start_date, end: end_date, revenue, orders, notes, source: 'orbit', createdBy: req.teamMember?.id || null });
    res.json(r);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** DELETE /:clientId/:date */
router.delete('/:clientId/:date', ownClient, requireEnabled, async (req, res) => {
  try {
    res.json(await deleteWhatsappSale(req.client.id, req.params.date));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** GET /:clientId/campaigns?start_date&end_date → campañas Meta con canal (auto/manual) y gasto */
router.get('/:clientId/campaigns', ownClient, requireEnabled, async (req, res) => {
  try {
    const r = range(req.query);
    if (!r) return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    res.json(await getCampaignChannels(req.client.id, r.start, r.end));
  } catch (error) {
    const fbMessage = error.response?.data?.error?.message;
    res.status(500).json({ error: fbMessage ? `Meta: ${fbMessage}` : error.message });
  }
});

/** PUT /:clientId/campaigns/:campaignId { channel: 'whatsapp'|'web'|'auto', campaign_name } */
router.put('/:clientId/campaigns/:campaignId', ownClient, requireEnabled, async (req, res) => {
  try {
    const { channel, campaign_name } = req.body || {};
    const r = await setCampaignChannel({ clientId: req.client.id, orgId: req.orgId, campaignId: req.params.campaignId, campaignName: campaign_name, channel });
    res.json(r);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /:clientId/recalculate { start_date, end_date } → recalcula fb_spend_whatsapp por día */
router.post('/:clientId/recalculate', ownClient, requireEnabled, async (req, res) => {
  try {
    const r = range(req.body || {});
    if (!r) return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    const days = (new Date(r.end) - new Date(r.start)) / 86400000;
    if (days > 370 || days < 0) return res.status(400).json({ error: 'Rango máximo: 1 año' });
    const result = await recalcWhatsappSpend(req.client.id, r.start, r.end);
    res.json({ updated: result.updated, reason: result.reason || null });
  } catch (error) {
    const fbMessage = error.response?.data?.error?.message;
    res.status(500).json({ error: fbMessage ? `Meta: ${fbMessage}` : error.message });
  }
});

export default router;
