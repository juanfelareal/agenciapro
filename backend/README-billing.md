# Orbit · Facturación (planes, add-ons y Bold)

Cobro de los planes de Orbit con **Bold** (bold.co), plan **anual** (10 meses por 12, precio
congelado 24 meses, garantía 30 días) y **add-ons** mensuales. Todo lo estático vive en
`src/config/planCatalog.js`; la lógica en `src/services/plans.js` (add-ons, límites) y
`src/services/billing.js` (cotización, Bold, activación).

## Variables de entorno

| Variable | Para qué | Si falta |
|---|---|---|
| `BOLD_API_KEY` | Llave de **identidad** de Bold (Panel → Integraciones → Llaves). Crea los links de pago (`Authorization: x-api-key <llave>`). | El checkout responde `provider: 'manual'` con instrucciones de transferencia. |
| `BOLD_WEBHOOK_SECRET` | Llave **secreta** de Bold. Verifica la firma `x-bold-signature` del webhook. | Producción: el webhook responde **503** y no procesa nada. Desarrollo: acepta sin firma (para probar con curl). |
| `BILLING_BANK_INSTRUCTIONS` | Texto con los datos de transferencia que ve el cliente en el checkout manual. | "Escríbenos a juanfe@larealmarketing.com con la referencia…". |
| `BILLING_CONTACT_EMAIL` | Reply-to del correo de confirmación y contacto del checkout manual. | `juanfe@larealmarketing.com` |
| `FRONTEND_URL` | Base del `callback_url` que Bold usa para devolver al cliente: `<FRONTEND_URL>/app/suscripcion?pago=<reference>`. Bold exige `https://`. | `https://orbit.larealmarketing.com` |
| `BOLD_MAX_LINK_AMOUNT` | Tope por link (Bold: 10.000.000 COP Nequi/Botón Bancolombia; 5.000.000 tarjeta/PSE). Totales mayores van por transferencia. | `10000000` |
| `BOLD_EXPIRATION_UNIT` | `ns` (nanosegundos, como dice la doc) o `ms` si Bold rechaza el valor. | `ns` |
| `BOLD_API_BASE` | Solo para sandbox/pruebas. | `https://integrations.api.bold.co` |

> ⚠️ El anual de **Agencia** (9.900.000 + IVA = **11.781.000**) supera el tope de Bold por link,
> así que hoy sale como `manual` (transferencia). Starter y Growth anual sí caben (2.963.100 y 5.819.100).

## Endpoints

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| `GET` | `/api/org/plan` | equipo | Estado del plan + `billing_cycle`, `addons` (efectivos), `addons_raw`, `addons_included`, `plan_renews_at`, `price_locked_until`, `limits` (ya con extras) y `catalog` (con `addons`, `annual`, `annual_price`/`annual_includes` por plan). |
| `GET/PUT` | `/api/org/addons` | admin | Cambio parcial `{ addons: { hourly_reports: true, extra_users: 2 } }`. 402 `{ upgrade:true, required_plan }` si el plan no lo permite; 400 si intenta apagar uno incluido en el anual. |
| `GET` | `/api/org/billing/quote?plan=&cycle=` | admin | Cotización (`amount`, `iva`, `total`, `includes`) sin crear nada. |
| `POST` | `/api/org/billing/checkout` `{ plan, cycle }` | admin | Crea `billing_payments` (pending) y el link de Bold → `{ provider:'bold', url, reference, amount, iva, total }` o `{ provider:'manual', reference, amount, iva, total, instructions }`. |
| `GET` | `/api/org/billing/payments` | admin | Pagos de la organización. |
| `GET` | `/api/org/billing/status?reference=` | admin | Estado de un pago (pantalla de retorno). Si sigue `pending` y hay link, consulta Bold y aplica el resultado por si el webhook no llegó. |
| `POST` | `/api/webhooks/bold` | Bold (sin auth) | Eventos `SALE_APPROVED` (activa el plan), `SALE_REJECTED`, `VOID_APPROVED`. Idempotente por referencia. Siempre 200 salvo firma inválida (401) o error interno (500 → Bold reintenta). |
| `PUT` | `/api/platform/organizations/:id/plan` | LA REAL | Activación manual: acepta además `billing_cycle`, `addons`, `plan_renews_at`, `price_locked_until`, `plan_price_locked`, `plan_started_at`. |

### Regla de add-on efectivo
Un add-on está activo si está en `organizations.addons` (`true` o entero > 0) **o** si el plan es
anual y el add-on está en `PLANS[plan].annual_includes`. Org 1 (LA REAL): todo activo siempre.
En código: `addonsFor(state)` / `isAddonEnabled(orgId, 'hourly_reports')` en `services/plans.js`.
Los límites de usuarios/marcas suman `extra_users` / `extra_brands`.

## Configurar el webhook en Bold

1. Panel de Comercios de Bold → **Integraciones** → **Webhooks** → *Configurar webhook*.
2. URL: `https://<backend>/api/webhooks/bold` (p. ej. `https://orbit-backend.up.railway.app/api/webhooks/bold`).
   Debe responder 200 en menos de 2 s; `GET` a esa URL devuelve `{ ok: true, configured: true|false }` para comprobar que está viva.
3. Copia la **llave secreta** a `BOLD_WEBHOOK_SECRET` y la **llave de identidad** a `BOLD_API_KEY` en Railway.
4. Firma: Bold manda `x-bold-signature` = HMAC-SHA256(llave secreta, **base64(cuerpo)**) en hex. `verifyBoldSignature()` lo verifica sobre el cuerpo crudo (la ruta va montada antes de `express.json()`).
5. Si Bold no entrega el evento, el frontend igual queda bien: `GET /api/org/billing/status` consulta el link
   (`GET /online/link/v1/{payment_link}`) y aplica el resultado.

Probar en local (sin secreto; `NODE_ENV=development`):
```bash
curl -s -X POST localhost:3005/api/webhooks/bold -H 'Content-Type: application/json' -d '{
  "type": "SALE_APPROVED",
  "data": { "payment_id": "x", "amount": { "total": 5819100 }, "metadata": { "reference": "orb_12_1760990000000_a1b2c3" }, "payment_method": "PSE" }
}'
```
Con secreto, firma el cuerpo con `signBoldBody(rawBody, secret)` (en `services/billing.js`) y mándala en `x-bold-signature`.

## Qué pasa cuando se aprueba un pago
`activateOrgPlan()`: `plan` = `plan_selected` = el pagado, `plan_status='active'`, `billing_cycle`,
`plan_started_at` (se conserva si renueva el mismo plan), `plan_renews_at` = +1 mes o +12 meses
(desde la renovación vigente si paga antes de que venza), `trial_ends_at=NULL`.
Anual: `price_locked_until` = +24 meses y `plan_price_locked` = precio mensual del plan.
Los `addons` no se tocan: los incluidos del anual salen por regla. Se envía el correo `payment-approved`
a los admins de la organización (y al `payer_email` de Bold).

## Activar a mano (transferencia)
Desde el panel de plataforma (o curl con un token de LA REAL):
```bash
curl -X PUT https://<backend>/api/platform/organizations/<id>/plan \
  -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' \
  -d '{ "plan": "growth", "plan_status": "active", "billing_cycle": "annual",
        "plan_renews_at": "2027-10-20", "price_locked_until": "2028-10-20", "plan_price_locked": 489000 }'
```
Si el cliente generó un checkout manual, opcionalmente marca su fila en `billing_payments`:
`UPDATE billing_payments SET status='approved', paid_at=now() WHERE reference='orb_...';`

## Cron diario (`services/billingCron.js`)
`runBillingDaily()`: planes `active` con `plan_renews_at` vencida hace más de 7 días → `past_due`
(nunca la org 1); pagos `pending` de más de 30 días → `voided`. Enganche en `server.js`:
```js
import { runBillingDaily } from './src/services/billingCron.js';
cron.schedule('30 0 * * *', () => runBillingDaily().catch((e) => console.error('❌ Billing daily:', e.message)), { scheduled: true, timezone: 'America/Bogota' });
```

## Montaje en `server.js`
```js
import orgBillingRoutes from './src/routes/org-billing.js';
import boldWebhookRoutes from './src/routes/webhooks-bold.js';
// antes de express.json():
app.use('/api/webhooks/bold', boldWebhookRoutes);
// junto a /api/org:
app.use('/api/org/billing', teamAuthMiddleware, orgBillingRoutes);
```
