/**
 * Adaptador del libro de pedidos para el panel interno (growthAPI).
 * Las tarjetas PurchasePatterns y CustomerMix solo conocen esta interfaz
 * `{ patterns, customerMix, backfill }` que devuelve los datos ya desenvueltos,
 * así el portal del cliente puede pasarles otro adaptador con sus propias rutas.
 */
import { growthAPI } from '../../../utils/api';

export const growthLedgerApi = {
  patterns: (clientId, days) => growthAPI.patterns(clientId, days).then((r) => r.data),
  customerMix: (clientId, start, end) => growthAPI.customerMix(clientId, start, end).then((r) => r.data),
  backfill: (clientId, days) => growthAPI.backfillOrders(clientId, days).then((r) => r.data),
};

export default growthLedgerApi;
