/**
 * Tienda del cliente (Shopify o WooCommerce) — punto único para saber qué tienda tiene
 * conectada un cliente y construir la integración correspondiente.
 *
 * Ambas integraciones exponen la misma interfaz, así que el sync diario, el P&L,
 * los productos/COGS y los top productos no necesitan saber cuál es.
 */
import db from '../config/database.js';
import ShopifyIntegration from './shopify.js';
import WooCommerceIntegration from './woocommerce.js';

export const STORE_PLATFORM_LABELS = { shopify: 'Shopify', woocommerce: 'WooCommerce' };
export const storeLabel = (platform) => STORE_PLATFORM_LABELS[platform] || 'Tienda';

export const STORE_CREDENTIAL_TABLES = {
  shopify: 'client_shopify_credentials',
  woocommerce: 'client_woocommerce_credentials',
};

/**
 * Credenciales de la tienda conectada del cliente (Shopify tiene prioridad si hubiera ambas).
 * @returns {null | { platform, store_url, status, last_sync_at, last_error, access_token?, consumer_key?, consumer_secret?, id }}
 */
export async function getStoreCredentials(clientId, { requireActive = false } = {}) {
  const shopify = await db.get(
    'SELECT id, store_url, access_token, status, last_sync_at, last_error FROM client_shopify_credentials WHERE client_id = ?',
    [clientId],
  );
  if (shopify?.store_url && shopify?.access_token && (!requireActive || shopify.status === 'active')) {
    return { platform: 'shopify', ...shopify };
  }
  const woo = await db.get(
    'SELECT id, store_url, consumer_key, consumer_secret, status, last_sync_at, last_error, store_name, currency FROM client_woocommerce_credentials WHERE client_id = ?',
    [clientId],
  );
  if (woo?.store_url && woo?.consumer_key && woo?.consumer_secret && (!requireActive || woo.status === 'active')) {
    return { platform: 'woocommerce', ...woo };
  }
  return null;
}

/** Construye la integración a partir de credenciales (de getStoreCredentials o de una fila de sync) */
export function createStoreIntegration(cred) {
  if (!cred) return null;
  if (cred.platform === 'woocommerce') {
    return new WooCommerceIntegration(cred.store_url, cred.consumer_key, cred.consumer_secret);
  }
  return new ShopifyIntegration(cred.store_url, cred.access_token);
}

/** Atajo: integración lista para usar o null si el cliente no tiene tienda conectada */
export async function getStoreIntegration(clientId, opts = {}) {
  const cred = await getStoreCredentials(clientId, opts);
  return cred ? { platform: cred.platform, cred, store: createStoreIntegration(cred) } : null;
}

export default { getStoreCredentials, createStoreIntegration, getStoreIntegration, storeLabel, STORE_CREDENTIAL_TABLES };
