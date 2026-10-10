/**
 * Conexión de tiendas WooCommerce (WordPress) con el flujo oficial "wc-auth":
 *
 *  1. GET  /url?client_id&store_url   → URL de autorización en la tienda (la abre un popup).
 *  2. El dueño de la tienda aprueba en WordPress. WooCommerce hace POST a /callback con
 *     { key_id, user_id (nuestro state), consumer_key, consumer_secret, key_permissions }
 *     y luego redirige el navegador a /return?success=1&user_id=<state>.
 *  3. El frontend hace polling a /callback-status?state= hasta que llegan las claves,
 *     muestra la tienda y confirma con POST /link-store.
 *
 * Notas: WooCommerce exige callback_url en HTTPS (no localhost). Las claves se guardan
 * en client_woocommerce_credentials. Alternativa manual: POST /api/platform-credentials/woocommerce.
 */
import { Router } from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import WooCommerceIntegration from '../integrations/woocommerce.js';

const router = Router();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Sesiones en memoria (igual que el OAuth de Shopify): state → { clientId, orgId, storeUrl, createdAt, keys? }
const sessions = new Map();
const SESSION_TTL_MS = 15 * 60 * 1000;

const cleanOld = () => {
  const limit = Date.now() - SESSION_TTL_MS;
  for (const [k, v] of sessions.entries()) if (v.createdAt < limit) sessions.delete(k);
};

const page = (res, { title, message, ok }) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{font-family:Inter,system-ui,sans-serif;background:#F3F4EF;color:#17181A;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .card{background:#fff;border-radius:20px;padding:32px;max-width:420px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.08)}
  .ok{color:#16a34a}.bad{color:#dc2626}p{color:#6B7280;font-size:14px}</style></head>
  <body><div class="card"><h2 class="${ok ? 'ok' : 'bad'}">${title}</h2><p>${message}</p><p>Puedes cerrar esta ventana.</p></div>
  <script>try{if(window.opener){window.opener.postMessage({type:'${ok ? 'woocommerce_auth_success' : 'woocommerce_auth_error'}'},'*');}}catch(e){} setTimeout(function(){window.close();},1500);</script></body></html>`);
};

/** GET /api/oauth/woocommerce/url — arma la URL de autorización (protegida) */
router.get('/url', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { client_id, store_url } = req.query;
    if (!client_id || !store_url) return res.status(400).json({ error: 'client_id y store_url son requeridos' });

    const client = await db.prepare('SELECT id, name, company FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const storeUrl = WooCommerceIntegration.normalizeStoreUrl(store_url);
    if (!storeUrl) return res.status(400).json({ error: 'URL de tienda inválida. Ej: https://mitienda.com' });
    if (!BACKEND_URL.startsWith('https://')) {
      return res.status(400).json({ error: 'WooCommerce exige un callback HTTPS; en local usa la conexión manual con claves API.' });
    }

    cleanOld();
    const state = crypto.randomBytes(16).toString('hex');
    sessions.set(state, { clientId: Number(client_id), orgId, storeUrl, createdAt: Date.now() });

    const params = new URLSearchParams({
      app_name: 'Orbit · LA REAL',
      scope: 'read',
      user_id: state,
      return_url: `${BACKEND_URL}/api/oauth/woocommerce/return?state=${state}`,
      callback_url: `${BACKEND_URL}/api/oauth/woocommerce/callback`,
    });
    res.json({ authUrl: `${storeUrl}/wc-auth/v1/authorize?${params.toString()}`, state, storeUrl });
  } catch (error) {
    console.error('WooCommerce auth url error:', error);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/oauth/woocommerce/callback — WooCommerce envía las claves (público) */
router.post('/callback', async (req, res) => {
  try {
    const body = req.body || {};
    const state = body.user_id;
    const session = state ? sessions.get(state) : null;
    if (!session) {
      console.warn('[woocommerce] callback con state desconocido');
      return res.status(400).json({ error: 'state inválido o expirado' });
    }
    if (!body.consumer_key || !body.consumer_secret) {
      return res.status(400).json({ error: 'faltan consumer_key / consumer_secret' });
    }
    session.keys = {
      consumer_key: body.consumer_key,
      consumer_secret: body.consumer_secret,
      key_id: body.key_id || null,
      key_permissions: body.key_permissions || 'read',
    };
    session.keysAt = Date.now();
    res.json({ ok: true });
  } catch (error) {
    console.error('WooCommerce callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/oauth/woocommerce/return — el navegador vuelve aquí tras aprobar (público) */
router.get('/return', (req, res) => {
  const { state, success } = req.query;
  const session = state ? sessions.get(state) : null;
  if (!session) return page(res, { ok: false, title: 'Sesión expirada', message: 'Vuelve a Orbit e intenta conectar de nuevo.' });
  if (String(success) === '0') {
    session.denied = true;
    return page(res, { ok: false, title: 'Conexión cancelada', message: 'No se autorizó el acceso a la tienda.' });
  }
  return page(res, { ok: true, title: 'Tienda autorizada', message: 'Vuelve a Orbit para confirmar la conexión.' });
});

/** GET /api/oauth/woocommerce/callback-status?state= — polling del frontend (público) */
router.get('/callback-status', async (req, res) => {
  const { state } = req.query;
  const session = state ? sessions.get(state) : null;
  if (!session) return res.json({ pending: false, type: 'woocommerce_auth_error', error: 'Sesión expirada o inválida' });
  if (session.denied) return res.json({ pending: false, type: 'woocommerce_auth_error', error: 'El acceso fue rechazado en la tienda' });
  if (!session.keys) return res.json({ pending: true });
  res.json({ pending: false, type: 'woocommerce_auth_success', sessionId: state, clientId: session.clientId, storeUrl: session.storeUrl });
});

/** GET /api/oauth/woocommerce/store-info?session_id= — prueba las claves y devuelve info (protegida) */
router.get('/store-info', async (req, res) => {
  try {
    const { session_id } = req.query;
    const session = session_id ? sessions.get(session_id) : null;
    if (!session?.keys) return res.status(401).json({ error: 'Sesión expirada. Vuelve a conectar la tienda.' });
    if (session.orgId !== req.orgId) return res.status(403).json({ error: 'Sesión de otra organización' });
    const woo = new WooCommerceIntegration(session.storeUrl, session.keys.consumer_key, session.keys.consumer_secret);
    const test = await woo.testConnection();
    if (!test.success) return res.status(400).json({ error: `Las claves no funcionan: ${test.error}` });
    res.json({ clientId: session.clientId, store: { name: test.storeName, url: session.storeUrl, currency: test.currency, timezone: test.timezone, permissions: session.keys.key_permissions } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/oauth/woocommerce/link-store — guarda las claves en el cliente (protegida) */
router.post('/link-store', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { session_id, client_id } = req.body || {};
    const session = session_id ? sessions.get(session_id) : null;
    if (!session?.keys) return res.status(401).json({ error: 'Sesión expirada. Vuelve a conectar la tienda.' });
    if (session.orgId !== orgId || Number(client_id) !== session.clientId) return res.status(403).json({ error: 'La sesión no corresponde a este cliente' });

    const woo = new WooCommerceIntegration(session.storeUrl, session.keys.consumer_key, session.keys.consumer_secret);
    const test = await woo.testConnection();

    await db.query(`
      INSERT INTO client_woocommerce_credentials (client_id, organization_id, store_url, consumer_key, consumer_secret, key_id, key_permissions, auth_method, store_name, currency, status, last_error)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'wc_auth', $8, $9, $10, $11)
      ON CONFLICT (client_id) DO UPDATE SET
        store_url = EXCLUDED.store_url, consumer_key = EXCLUDED.consumer_key, consumer_secret = EXCLUDED.consumer_secret,
        key_id = EXCLUDED.key_id, key_permissions = EXCLUDED.key_permissions, auth_method = 'wc_auth',
        store_name = EXCLUDED.store_name, currency = EXCLUDED.currency, status = EXCLUDED.status, last_error = EXCLUDED.last_error,
        updated_at = CURRENT_TIMESTAMP
    `, [
      session.clientId, orgId, session.storeUrl, session.keys.consumer_key, session.keys.consumer_secret,
      session.keys.key_id, session.keys.key_permissions, test.storeName || null, test.currency || null,
      test.success ? 'active' : 'error', test.success ? null : test.error,
    ]);
    sessions.delete(session_id);
    res.json({ message: 'Tienda WooCommerce vinculada', connected: test.success, store: { name: test.storeName, url: session.storeUrl } });
  } catch (error) {
    console.error('WooCommerce link-store error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
