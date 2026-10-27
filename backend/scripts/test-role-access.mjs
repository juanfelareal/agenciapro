#!/usr/bin/env node
/**
 * Prueba automatizada de PERMISOS POR MÓDULO en la API (Orbit / AgenciaPro).
 *
 * Contexto: el frontend esconde módulos según team_members.permissions, pero hasta
 * ahora la API no lo aplicaba (cualquier miembro podía llamar /api/invoices,
 * /api/dashboard/stats, /api/reports/financial… vía MCP o curl y ver el dinero de
 * la agencia). Esta suite comprueba que el backend aplica la MISMA regla del frontend:
 * admin = todo; los demás solo lo que tengan en true (o los DEFAULT_PERMISSIONS si
 * su JSON está vacío). manager NO es admin.
 *
 * Crea una organización temporal con un admin y 3 miembros:
 *   - trafficker  → metricas/clients/projects/tasks en true, todo lo financiero en false
 *   - nullperms   → permissions = null (aplican los DEFAULT_PERMISSIONS)
 *   - manager     → rol manager con team/crm/metricas en true e invoices (y demás finanzas) en false
 * Siembra 1 cliente con contract_value, 1 factura, 1 gasto, 1 meta de ventas y comprueba:
 *   - endpoints de dinero de la agencia → 403 para los 3 (con { error, module })
 *   - /search sin facturas · /clients sin contract_value · /team sin campos sensibles
 *   - el dashboard carga sin cifras (finances en null, listas vacías)
 *   - el admin sigue viendo todo (200 con datos)
 *   - quien tiene 'metricas' sí ve /growth y /client-metrics (finanzas del CLIENTE)
 *   - un no-admin con 'team' no puede auto-promoverse ni tocar a un admin
 *
 * USO (contra una base LOCAL de prueba, nunca producción):
 *
 *   cd backend
 *   DATABASE_URL=postgres://localhost:5432/orbit_demo node scripts/test-role-access.mjs
 *
 * Opciones:
 *   --base http://127.0.0.1:3013   usa un servidor ya levantado (no arranca uno)
 *   --no-init                      no corre initializeDatabase() antes (asume esquema listo)
 *   --keep                         no borra los datos creados al final
 *
 * Código de salida: 0 si todo pasa, 1 si alguna prueba falla o falta configuración.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Argumentos y configuración
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const externalBase = argValue('--base');
const runInit = !args.includes('--no-init');
const keepData = args.includes('--keep');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('\n❌ Falta DATABASE_URL (base local de prueba), p. ej.:');
  console.error('     DATABASE_URL=postgres://localhost:5432/orbit_demo node scripts/test-role-access.mjs\n');
  process.exit(1);
}
let dbHost = '';
try { dbHost = new URL(DATABASE_URL).hostname; } catch { /* ignore */ }
const isLocal = ['localhost', '127.0.0.1', '::1', ''].includes(dbHost);
if (!isLocal && process.env.ALLOW_REMOTE_TEST_DB !== '1') {
  console.error(`\n❌ DATABASE_URL apunta a "${dbHost}", que no es local. Esta prueba crea y borra datos.`);
  console.error('   Usa una base local de prueba, o fuerza con ALLOW_REMOTE_TEST_DB=1 si sabes lo que haces.\n');
  process.exit(1);
}
process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'test' : (process.env.NODE_ENV || 'test');

// ---------------------------------------------------------------------------
// 1) Conexión y esquema
// ---------------------------------------------------------------------------
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
try {
  await pool.query('SELECT 1');
} catch (err) {
  console.error(`\n❌ No se pudo conectar a la base de prueba: ${err.message}\n`);
  process.exit(1);
}

if (runInit) {
  console.log('🔧 Inicializando esquema con initializeDatabase()...');
  const { initializeDatabase } = await import('../src/config/database.js');
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try { await initializeDatabase(); lastErr = null; break; } catch (e) { lastErr = e; console.warn(`   (pasada ${attempt} incompleta: ${e.message}; reintentando)`); }
  }
  if (lastErr) { console.error('❌ No se pudo inicializar el esquema:', lastErr.message); process.exit(1); }
  console.log('✅ Esquema listo\n');
}

// ---------------------------------------------------------------------------
// 2) Servidor (propio o externo)
// ---------------------------------------------------------------------------
let serverProc = null;
let base = externalBase;
const run = Date.now().toString(36);
const stamp = `roles-${run}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  const port = 3900 + Math.floor(Math.random() * 100);
  base = `http://127.0.0.1:${port}`;
  console.log(`🚀 Arrancando backend de prueba en ${base} ...`);
  serverProc = spawn(process.execPath, ['server.js'], {
    cwd: backendDir,
    env: {
      ...process.env, PORT: String(port), DATABASE_URL, NODE_ENV: 'test', FRONTEND_URL: base, EMAIL_PROVIDER: 'log',
      RESEND_API_KEY: '', SMTP_HOST: '', KAPSO_API_KEY: '', ANTHROPIC_API_KEY: '', BLOB_READ_WRITE_TOKEN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false; let output = '';
  const serverLog = path.join(os.tmpdir(), `orbit-role-test-server-${run}.log`);
  const logStream = fs.createWriteStream(serverLog);
  console.log(`   (log del servidor: ${serverLog})`);
  serverProc.stdout.on('data', (d) => {
    const s = d.toString(); output += s; logStream.write(s);
    if (s.includes('Database schema ready') || s.includes('Application fully operational') || s.includes('Application operational')) ready = true;
  });
  serverProc.stderr.on('data', (d) => { output += d.toString(); logStream.write(d); });
  serverProc.on('exit', () => { if (!ready) { console.error('❌ El servidor terminó antes de estar listo. Salida:\n' + output.slice(-4000)); process.exit(1); } });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (ready) { try { const r = await fetch(`${base}/api/health`); if (r.ok) break; } catch { /* retry */ } }
    await sleep(500);
  }
  if (!ready) { console.error('❌ Timeout esperando al servidor. Salida:\n' + output.slice(-4000)); process.exit(1); }
  await sleep(1500);
  console.log('✅ Servidor listo\n');
}
if (!base) await startServer();

// ---------------------------------------------------------------------------
// 3) Utilidades HTTP y de aserción
// ---------------------------------------------------------------------------
const results = [];
let failures = 0;

async function api(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}/api${url}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, raw: text };
}

function record(ok, label, detail = '') {
  results.push({ ok, label, detail });
  if (!ok) failures++;
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${detail ? `  → ${detail}` : ''}`);
}

const short = (r) => String(r.raw).slice(0, 160);

/** Espera 403 "No tienes permiso para este módulo" (o 403 module_disabled si el plan no tiene el módulo). */
async function expectForbidden(who, method, url, token, body, moduleKey) {
  const r = await api(method, url, { token, body });
  const adminGate = /administrador/i.test(`${r.data?.error || ''} ${r.data?.message || ''}`); // requireAdmin: { error: 'Acceso denegado', message: 'Se requiere rol de administrador' }
  const perm = r.status === 403 && (r.data?.error === 'No tienes permiso para este módulo' || r.data?.module_disabled === true || adminGate);
  const modOk = !moduleKey || r.data?.module_disabled === true || r.data?.module === moduleKey || adminGate;
  const ok = perm && modOk;
  record(ok, `[${who}] ${method.padEnd(6)} ${url} → 403`, ok ? `${r.status} ${r.data?.module_disabled ? '(módulo apagado en el plan)' : `module=${r.data?.module ?? '-'}`}` : `recibió ${r.status}: ${short(r)}`);
  return r;
}

/** Espera 2xx. */
async function expectOk(who, method, url, token, body, label) {
  const r = await api(method, url, { token, body });
  const ok = r.status >= 200 && r.status < 300;
  record(ok, label || `[${who}] ${method.padEnd(6)} ${url} → 2xx`, ok ? `${r.status}` : `recibió ${r.status}: ${short(r)}`);
  return r;
}

/** Para endpoints con bugs SQL previos (ajenos a este cambio) solo exigimos que NO sea un bloqueo de permisos. */
async function expectNotBlocked(who, method, url, token) {
  const r = await api(method, url, { token });
  const ok = r.status !== 401 && r.status !== 403;
  record(ok, `[${who}] ${method.padEnd(6)} ${url} → no bloqueado por permisos`, ok ? `${r.status}${r.status >= 500 ? ' (error SQL previo, no de permisos)' : ''}` : `recibió ${r.status}: ${short(r)}`);
  return r;
}

/** Como expectOk, pero si el plan no tiene el módulo acepta 403 module_disabled (el admin no puede ver lo que el plan no incluye). */
async function expectOkOrModuleOff(who, method, url, token) {
  const r = await api(method, url, { token });
  const ok = (r.status >= 200 && r.status < 300) || (r.status === 403 && r.data?.module_disabled === true);
  record(ok, `[${who}] ${method.padEnd(6)} ${url} → 2xx (o módulo apagado en el plan)`, ok ? `${r.status}${r.data?.module_disabled ? ' module_disabled' : ''}` : `recibió ${r.status}: ${short(r)}`);
  return r;
}

const SENSITIVE_MEMBER_FIELDS = ['pin_hash', 'permissions', 'hire_date', 'birthday', 'user_id'];
const CLIENT_MONEY_FIELDS = ['contract_value', 'recurring_amount', 'is_recurring', 'billing_day', 'valor_contratado', 'has_comision', 'comision_detalle', 'commission_rate', 'commission_deduction', 'commission_threshold', 'commission_rate_above'];
const hasAnyKey = (obj, keys) => keys.filter((k) => obj && Object.prototype.hasOwnProperty.call(obj, k));

// ---------------------------------------------------------------------------
// 4) Organización, admin y miembros
// ---------------------------------------------------------------------------
console.log('👥 Registrando organización y admin...');
const reg = await api('POST', '/auth/register', {
  body: { name: `Admin ${run}`, email: `role-admin-${run}@test.local`, pin: '1234', org_name: `Org Roles ${run}` },
});
if (reg.status !== 201) { console.error(`register falló: ${reg.status} ${reg.raw}`); process.exit(1); }
const ADMIN = { token: reg.data.token, orgId: reg.data.current_org.id, memberId: reg.data.user.id };
record(true, 'Org temporal creada', `org=${ADMIN.orgId} admin=${ADMIN.memberId}`);

const TRAFFICKER_PERMS = {
  dashboard: true, metricas: true, clients: true, projects: true, plantillas: false,
  tasks: true, calendario: true, invoices: false, expenses: false, comisiones: false, siigo: false,
  team: false, automatizaciones: false, notas: true, formularios: true, sops: true, reportes: false, ugc: false, crm: false,
};
const MANAGER_PERMS = {
  dashboard: true, metricas: true, clients: true, projects: true, plantillas: true, crm: true,
  tasks: true, calendario: true, invoices: false, expenses: false, comisiones: false, siigo: false,
  team: true, automatizaciones: true, notas: true, formularios: true, sops: true, reportes: false, ugc: false,
};

async function createMember(tag, { role, permissions }) {
  const email = `role-${tag}-${run}@test.local`;
  const body = { name: `${tag} ${run}`, email, role, position: tag, pin: '1234', hire_date: '2024-02-01', birthday: '1995-05-05' };
  if (permissions !== undefined) body.permissions = permissions;
  const c = await api('POST', '/team', { token: ADMIN.token, body });
  if (c.status !== 201) { console.error(`crear miembro ${tag} falló: ${c.status} ${c.raw}`); process.exit(1); }
  const l = await api('POST', '/auth/login', { body: { email, pin: '1234' } });
  if (l.status !== 200 || !l.data?.token) { console.error(`login ${tag} falló: ${l.status} ${l.raw}`); process.exit(1); }
  record(true, `Miembro "${tag}" creado y logueado`, `role=${role} id=${c.data.id}`);
  return { tag, token: l.data.token, memberId: c.data.id, role };
}

const TRAFF = await createMember('trafficker', { role: 'member', permissions: TRAFFICKER_PERMS });
const NULLP = await createMember('nullperms', { role: 'member' });
const MGR = await createMember('manager', { role: 'manager', permissions: MANAGER_PERMS });
const MEMBERS = [TRAFF, NULLP, MGR];

// Confirmar en BD que nullperms quedó sin permisos
{
  const row = (await pool.query('SELECT permissions FROM team_members WHERE id = $1', [NULLP.memberId])).rows[0];
  record(row && (row.permissions === null || row.permissions === '' || row.permissions === '{}'), 'nullperms tiene permissions NULL en BD (aplican los defaults)', `permissions=${row?.permissions}`);
}

// ---------------------------------------------------------------------------
// 5) Datos: cliente con contract_value, proyecto, factura, gasto, meta de ventas
// ---------------------------------------------------------------------------
console.log('\n📦 Sembrando datos con el admin...');
const INVOICE_NOTE = `Factura secreta ${stamp}`;
const client = (await expectOk('admin', 'POST', '/clients', ADMIN.token, {
  name: `Cliente ${stamp}`, company: `Empresa ${stamp}`, email: `c-${run}@test.local`, contract_value: 2500000, recurring_amount: 2500000, billing_day: 5,
}, '[admin] crear cliente con contract_value')).data;
const clientId = client.id ?? client.client?.id;
const project = (await expectOk('admin', 'POST', '/projects', ADMIN.token, { name: `Proyecto ${stamp}`, client_id: clientId }, '[admin] crear proyecto')).data;
await expectOk('admin', 'POST', `/projects/${project.id}/team`, ADMIN.token, { team_member_id: TRAFF.memberId }, '[admin] asignar trafficker al proyecto');
const invoice = (await expectOk('admin', 'POST', '/invoices', ADMIN.token, { client_id: clientId, project_id: project.id, amount: 1000000, status: 'paid', issue_date: '2026-01-15', notes: INVOICE_NOTE }, '[admin] crear factura pagada')).data;
const expense = (await expectOk('admin', 'POST', '/expenses', ADMIN.token, { description: `Gasto ${stamp}`, amount: 300000, expense_date: '2026-01-15', category: 'other', project_id: project.id }, '[admin] crear gasto')).data;
await expectOk('admin', 'PUT', '/sales-goals/2026/1', ADMIN.token, { goal_amount: 50000000 }, '[admin] fijar meta de ventas ene-2026');

// ---------------------------------------------------------------------------
// 6) Dinero de la agencia → 403 para los 3 miembros
// ---------------------------------------------------------------------------
const MONEY_ENDPOINTS = [
  ['GET', '/invoices', 'invoices'],
  ['GET', `/invoices/${invoice.id}`, 'invoices'],
  ['GET', '/collections/summary', 'invoices'],
  ['GET', '/collections/invoices', 'invoices'],
  ['GET', '/bank-statements/periods', 'invoices'],
  ['GET', '/expenses', 'expenses'],
  ['GET', `/expenses/${expense.id}`, 'expenses'],
  ['GET', '/commissions', 'comisiones'],
  ['GET', '/commissions/report/monthly', 'comisiones'],
  ['GET', '/siigo/settings', 'siigo'],
  ['GET', '/payroll/periods', 'payroll'],
  ['GET', '/reports/financial', 'reportes'],
  ['GET', '/reports/productivity', 'reportes'],
  ['GET', '/audit-log', null],
];

for (const M of MEMBERS) {
  console.log(`\n🔒 [${M.tag}] (${M.role}) no debe ver el dinero de la agencia...`);
  for (const [method, url, mod] of MONEY_ENDPOINTS) await expectForbidden(M.tag, method, url, M.token, undefined, mod);
  // Escrituras también
  await expectForbidden(M.tag, 'POST', '/invoices', M.token, { client_id: clientId, amount: 1, issue_date: '2026-01-01' }, 'invoices');
  await expectForbidden(M.tag, 'POST', '/expenses', M.token, { description: 'x', amount: 1, expense_date: '2026-01-01', category: 'other' }, 'expenses');
}

// Forma exacta del 403
{
  const r = await api('GET', '/invoices', { token: TRAFF.token });
  record(r.status === 403 && r.data?.error === 'No tienes permiso para este módulo' && r.data?.module === 'invoices',
    '403 con el cuerpo esperado { error: "No tienes permiso para este módulo", module: "invoices" }', short(r));
}

// ---------------------------------------------------------------------------
// 7) Dashboard carga SIN cifras · search sin facturas · clients sin contract_value · team sin sensibles
// ---------------------------------------------------------------------------
for (const M of MEMBERS) {
  console.log(`\n📊 [${M.tag}] dashboard, búsqueda, clientes y equipo sin datos sensibles...`);

  const st = await api('GET', '/dashboard/stats', { token: M.token });
  const f = st.data?.finances || {};
  record(st.status === 200 && st.data?.finances_restricted === true, `[${M.tag}] GET /dashboard/stats carga (200) y marca finances_restricted`, `${st.status}`);
  record(st.status === 200 && f.total_invoiced_net === null && f.total_paid_net === null && f.net_income === null && f.total_expenses_amount === null,
    `[${M.tag}] stats.finances sin cifras (todo null)`, JSON.stringify(f).slice(0, 120));
  record(st.status === 200 && st.data?.clients?.total_contract_value === null && Number(st.data?.clients?.total) >= 1,
    `[${M.tag}] stats.clients: conteo sí, total_contract_value null`, JSON.stringify(st.data?.clients));
  record(st.status === 200 && st.data?.tasks && typeof st.data.tasks === 'object', `[${M.tag}] stats.tasks presente (el Dashboard sigue funcionando)`);

  const tr = await api('GET', '/dashboard/revenue-trend?months=6', { token: M.token });
  record(tr.status === 200 && Array.isArray(tr.data) && tr.data.length === 0, `[${M.tag}] GET /dashboard/revenue-trend → 200 []`, `${tr.status} len=${Array.isArray(tr.data) ? tr.data.length : '-'}`);

  const ov = await api('GET', '/dashboard/overdue-invoices', { token: M.token });
  record(ov.status === 200 && Array.isArray(ov.data) && ov.data.length === 0, `[${M.tag}] GET /dashboard/overdue-invoices → 200 []`, `${ov.status}`);

  const mc = await api('GET', '/dashboard/monthly-sales-comparison?year=2026', { token: M.token });
  const jan = mc.data?.months?.find((m) => m.month === 1);
  record(mc.status === 200 && mc.data?.sales_restricted === true && jan && jan.sales_net === null && jan.sales_gross === null && jan.prev_sales_net === null,
    `[${M.tag}] GET /dashboard/monthly-sales-comparison → ventas en null`, JSON.stringify(jan));
  record(mc.status === 200 && jan && Number(jan.goal) === 50000000, `[${M.tag}] …pero la meta del mes (sales-goals → dashboard) sí se ve`, `goal=${jan?.goal}`);

  const ra = await api('GET', '/dashboard/recent-activity', { token: M.token });
  record(ra.status === 200 && Array.isArray(ra.data) && !ra.data.some((x) => 'amount' in x), `[${M.tag}] GET /dashboard/recent-activity sigue abierto y sin montos`, `${ra.status}`);

  // search
  const s1 = await api('GET', `/search?q=${encodeURIComponent(stamp)}`, { token: M.token });
  record(s1.status === 200 && (s1.data?.results?.invoices || []).length === 0, `[${M.tag}] GET /search no incluye facturas`, `invoices=${(s1.data?.results?.invoices || []).length}`);
  record(s1.status === 200 && (s1.data?.results?.clients || []).some((c) => c.id === clientId), `[${M.tag}] GET /search sí encuentra el cliente`, `clients=${(s1.data?.results?.clients || []).length}`);
  const s2 = await api('GET', `/search?q=${encodeURIComponent(INVOICE_NOTE)}`, { token: M.token });
  record(s2.status === 200 && !JSON.stringify(s2.data).includes('1000000') && (s2.data?.results?.invoices || []).length === 0, `[${M.tag}] GET /search por la nota de la factura no devuelve el monto`, `${s2.status}`);

  // clients
  const cl = await api('GET', '/clients', { token: M.token });
  const mine = Array.isArray(cl.data) ? cl.data.find((c) => c.id === clientId) : null;
  record(cl.status === 200 && mine && hasAnyKey(mine, CLIENT_MONEY_FIELDS).length === 0, `[${M.tag}] GET /clients sin contract_value ni campos de fee`, mine ? `campos de dinero presentes: ${hasAnyKey(mine, CLIENT_MONEY_FIELDS).join(',') || 'ninguno'}` : `status ${cl.status}`);
  record(cl.status === 200 && mine && mine.company === `Empresa ${stamp}` && mine.email === `c-${run}@test.local` && 'nit' in mine, `[${M.tag}] GET /clients conserva el resto de la ficha (company, email, nit…)`);
  const c1 = await api('GET', `/clients/${clientId}`, { token: M.token });
  record(c1.status === 200 && hasAnyKey(c1.data, CLIENT_MONEY_FIELDS).length === 0, `[${M.tag}] GET /clients/:id sin contract_value`, `${c1.status} ${hasAnyKey(c1.data, CLIENT_MONEY_FIELDS).join(',') || 'ok'}`);
  const up = await api('PUT', `/clients/${clientId}`, { token: M.token, body: { contract_value: 1, recurring_amount: 1, notes: `nota de ${M.tag}` } });
  const after = (await pool.query('SELECT contract_value, recurring_amount, notes FROM clients WHERE id = $1', [clientId])).rows[0];
  record(up.status === 200 && Number(after.contract_value) === 2500000 && Number(after.recurring_amount) === 2500000 && after.notes === `nota de ${M.tag}`,
    `[${M.tag}] PUT /clients/:id ignora contract_value/recurring_amount pero guarda lo demás`, `${up.status} contract_value=${after.contract_value} notes=${after.notes}`);
  record(up.status === 200 && hasAnyKey(up.data, CLIENT_MONEY_FIELDS).length === 0, `[${M.tag}] …y la respuesta del PUT tampoco trae dinero`);

  // team
  const tm = await api('GET', '/team', { token: M.token });
  const leaked = Array.isArray(tm.data) ? tm.data.flatMap((m) => hasAnyKey(m, SENSITIVE_MEMBER_FIELDS)) : ['(no es lista)'];
  record(tm.status === 200 && Array.isArray(tm.data) && tm.data.length >= 4 && leaked.length === 0, `[${M.tag}] GET /team sin pin_hash/permissions/hire_date/birthday/user_id`, leaked.length ? `fugas: ${[...new Set(leaked)].join(',')}` : `${tm.data?.length} miembros`);
  record(tm.status === 200 && (tm.data || []).every((m) => 'id' in m && 'name' in m && 'email' in m && 'role' in m), `[${M.tag}] GET /team conserva id/name/email/role (para asignar tareas)`);
  const t1 = await api('GET', `/team/${ADMIN.memberId}`, { token: M.token });
  record(t1.status === 200 && hasAnyKey(t1.data, SENSITIVE_MEMBER_FIELDS).length === 0 && Array.isArray(t1.data?.projects), `[${M.tag}] GET /team/:id (admin) sin campos sensibles`, `${t1.status} ${hasAnyKey(t1.data, SENSITIVE_MEMBER_FIELDS).join(',') || 'ok'}`);
  const pj = await api('GET', `/projects/${project.id}`, { token: M.token });
  const pjLeak = (pj.data?.team || []).flatMap((m) => hasAnyKey(m, SENSITIVE_MEMBER_FIELDS));
  record(pj.status === 200 && (pj.data?.team || []).length >= 1 && pjLeak.length === 0, `[${M.tag}] GET /projects/:id .team sin pin_hash/permissions`, pjLeak.length ? `fugas: ${pjLeak.join(',')}` : 'ok');
}

// ---------------------------------------------------------------------------
// 8) Escrituras de equipo: sin 'team' → 403; con 'team' (manager) sin auto-promoción
// ---------------------------------------------------------------------------
console.log('\n🛡  Escrituras sobre el equipo...');
for (const M of [TRAFF, NULLP]) {
  await expectForbidden(M.tag, 'PUT', `/team/${M.memberId}`, M.token, { name: `${M.tag} ${run}`, email: `role-${M.tag}-${run}@test.local`, role: 'admin', position: M.tag, status: 'active' }, 'team');
  await expectForbidden(M.tag, 'POST', '/team', M.token, { name: 'Intruso', email: `intruso-${M.tag}-${run}@test.local`, role: 'member' }, 'team');
  await expectForbidden(M.tag, 'DELETE', `/team/${MGR.memberId}`, M.token, undefined, 'team');
  const role = (await pool.query('SELECT role FROM team_members WHERE id = $1', [M.memberId])).rows[0]?.role;
  record(role === 'member', `[${M.tag}] sigue siendo member en BD`, `role=${role}`);
}
{
  // manager tiene team:true → puede editar, pero no cambiar su rol/permisos ni tocar al admin
  // (PUT /team/:id es una actualización completa, como la manda el frontend)
  const r1 = await api('PUT', `/team/${MGR.memberId}`, { token: MGR.token, body: { name: `manager ${run}`, email: `role-manager-${run}@test.local`, position: 'manager', status: 'active', role: 'admin', permissions: { ...MANAGER_PERMS, invoices: true } } });
  const row = (await pool.query('SELECT role, permissions FROM team_members WHERE id = $1', [MGR.memberId])).rows[0];
  const perms = row?.permissions ? JSON.parse(row.permissions) : {};
  record(r1.status === 200 && row?.role === 'manager' && perms.invoices === false, '[manager] PUT /team/:self con role=admin e invoices=true → 200 pero rol y permisos NO cambian', `${r1.status} role=${row?.role} invoices=${perms.invoices}`);
  const inv = await api('GET', '/invoices', { token: MGR.token });
  record(inv.status === 403, '[manager] …y sigue sin ver /invoices', `${inv.status}`);
  await expectForbidden('manager', 'PUT', `/team/${ADMIN.memberId}`, MGR.token, { name: 'Hack', email: `role-admin-${run}@test.local`, role: 'member', status: 'active' }, 'team');
  await expectForbidden('manager', 'POST', '/team', MGR.token, { name: 'Nuevo admin', email: `nuevoadmin-${run}@test.local`, role: 'admin' }, 'team');
  await expectForbidden('manager', 'DELETE', `/team/${ADMIN.memberId}`, MGR.token, undefined, 'team');
  const ok = await api('PUT', `/team/${TRAFF.memberId}`, { token: MGR.token, body: { name: `trafficker ${run}`, email: `role-trafficker-${run}@test.local`, position: 'Trafficker Sr', status: 'active', role: 'admin' } });
  const trow = (await pool.query('SELECT role, position, hire_date, birthday, permissions FROM team_members WHERE id = $1', [TRAFF.memberId])).rows[0];
  record(ok.status === 200 && trow?.role === 'member' && trow?.position === 'Trafficker Sr', '[manager] PUT /team/:trafficker cambia el cargo pero no puede volverlo admin', `${ok.status} role=${trow?.role} position=${trow?.position}`);
  record(ok.status === 200 && String(trow?.hire_date).startsWith('2024-02-01') && String(trow?.birthday).startsWith('1995-05-05') && JSON.parse(trow?.permissions || '{}').metricas === true,
    '[manager] …y no borra hire_date/birthday/permissions que no puede ver', `hire_date=${trow?.hire_date} birthday=${trow?.birthday}`);
  record(ok.status === 200 && hasAnyKey(ok.data, SENSITIVE_MEMBER_FIELDS).length === 0, '[manager] la respuesta del PUT no trae campos sensibles');
}

// ---------------------------------------------------------------------------
// 9) Métricas/finanzas del CLIENTE (growth, client-metrics) → solo con 'metricas'
// ---------------------------------------------------------------------------
console.log('\n📈 Finanzas por marca del cliente (metricas)...');
const METRIC_URLS = [`/client-metrics/${clientId}?start_date=2026-01-01&end_date=2026-01-31`, `/growth/${clientId}`, `/growth/clients/${clientId}/financials?period=2026-01`];
for (const url of METRIC_URLS) {
  for (const M of [TRAFF, MGR]) {
    const r = await api('GET', url, { token: M.token });
    const ok = r.status !== 401 && r.status !== 403 && r.status < 500;
    record(ok, `[${M.tag}] (metricas:true) GET ${url} → permitido`, `${r.status}`);
  }
  await expectForbidden('nullperms', 'GET', url, NULLP.token, undefined, 'metricas');
}
{
  // Email marketing (sin dinero) sigue disponible para quien tenga 'clients'
  const r = await api('GET', '/client-metrics/email-dashboard?year=2026&month=1', { token: NULLP.token });
  record(r.status !== 401 && r.status !== 403 && r.status < 500, '[nullperms] (clients por defecto) GET /client-metrics/email-dashboard → permitido', `${r.status}`);
}
// CRM (valores estimados del pipeline) → solo con 'crm'
await expectForbidden('trafficker', 'GET', '/crm/deals', TRAFF.token, undefined, 'crm');
await expectForbidden('nullperms', 'GET', '/crm/deals', NULLP.token, undefined, 'crm');
await expectOkOrModuleOff('manager', 'GET', '/crm/deals', MGR.token);

// Lo operativo sigue abierto para los defaults
await expectOk('nullperms', 'GET', '/tasks', NULLP.token, undefined, '[nullperms] GET /tasks (default tasks:true) → 200');
await expectOk('nullperms', 'GET', '/projects', NULLP.token, undefined, '[nullperms] GET /projects (default projects:true) → 200');
await expectOk('trafficker', 'GET', '/sales-goals?year=2026', TRAFF.token, undefined, '[trafficker] GET /sales-goals (dashboard:true) → 200');

// ---------------------------------------------------------------------------
// 10) El admin sigue viendo todo
// ---------------------------------------------------------------------------
console.log('\n👑 El admin sigue viendo todo...');
{
  const inv = await expectOk('admin', 'GET', '/invoices', ADMIN.token);
  record(inv.status === 200 && JSON.stringify(inv.data).includes(`"id":${invoice.id}`), '[admin] GET /invoices incluye la factura sembrada');
  await expectOk('admin', 'GET', `/invoices/${invoice.id}`, ADMIN.token);
  await expectOk('admin', 'GET', '/expenses', ADMIN.token);
  await expectOk('admin', 'GET', '/commissions', ADMIN.token);
  await expectNotBlocked('admin', 'GET', '/reports/financial', ADMIN.token); // SQL previo: HAVING sobre alias
  await expectOk('admin', 'GET', '/reports/team', ADMIN.token);
  await expectOk('admin', 'GET', '/collections/summary', ADMIN.token);
  await expectOk('admin', 'GET', '/bank-statements/periods', ADMIN.token);
  await expectOk('admin', 'GET', '/audit-log', ADMIN.token);
  await expectOk('admin', 'GET', '/sales-goals?year=2026', ADMIN.token);
  await expectOkOrModuleOff('admin', 'GET', '/payroll/periods', ADMIN.token);
  await expectOkOrModuleOff('admin', 'GET', '/siigo/settings', ADMIN.token);
  await expectOkOrModuleOff('admin', 'GET', `/growth/${clientId}`, ADMIN.token);
  await expectOkOrModuleOff('admin', 'GET', '/crm/deals', ADMIN.token);

  const st = await api('GET', '/dashboard/stats', { token: ADMIN.token });
  record(st.status === 200 && st.data?.finances_restricted === false && Number(st.data?.finances?.total_invoiced_net) >= 1000000 && Number(st.data?.finances?.total_expenses_amount) >= 300000 && Number(st.data?.clients?.total_contract_value) >= 2500000,
    '[admin] GET /dashboard/stats con cifras reales (facturado, gastos, contract_value)', JSON.stringify({ inv: st.data?.finances?.total_invoiced_net, exp: st.data?.finances?.total_expenses_amount, cv: st.data?.clients?.total_contract_value }));
  const mc = await api('GET', '/dashboard/monthly-sales-comparison?year=2026', { token: ADMIN.token });
  const jan = mc.data?.months?.find((m) => m.month === 1);
  record(mc.status === 200 && mc.data?.sales_restricted === false && Number(jan?.sales_net) >= 1000000, '[admin] GET /dashboard/monthly-sales-comparison con ventas de enero', `sales_net=${jan?.sales_net}`);
  await expectNotBlocked('admin', 'GET', '/dashboard/revenue-trend?months=12', ADMIN.token); // SQL previo: paid_date es text vs INTERVAL
  await expectNotBlocked('admin', 'GET', '/dashboard/overdue-invoices', ADMIN.token); // SQL previo: due_date es text vs CURRENT_DATE

  const s = await api('GET', `/search?q=${encodeURIComponent(INVOICE_NOTE)}`, { token: ADMIN.token });
  record(s.status === 200 && (s.data?.results?.invoices || []).some((i) => i.id === invoice.id), '[admin] GET /search sí incluye la factura', `invoices=${(s.data?.results?.invoices || []).length}`);

  const cl = await api('GET', `/clients/${clientId}`, { token: ADMIN.token });
  record(cl.status === 200 && Number(cl.data?.contract_value) === 2500000, '[admin] GET /clients/:id trae contract_value', `contract_value=${cl.data?.contract_value}`);

  const tm = await api('GET', '/team', { token: ADMIN.token });
  const t = Array.isArray(tm.data) ? tm.data.find((m) => m.id === TRAFF.memberId) : null;
  record(tm.status === 200 && t && 'permissions' in t && 'hire_date' in t && 'birthday' in t && !('pin_hash' in t), '[admin] GET /team trae permissions/hire_date/birthday (y nunca pin_hash)', t ? Object.keys(t).join(',') : `${tm.status}`);
  const t1 = await api('GET', `/team/${TRAFF.memberId}`, { token: ADMIN.token });
  record(t1.status === 200 && 'permissions' in (t1.data || {}) && !('pin_hash' in (t1.data || {})), '[admin] GET /team/:id completo sin pin_hash');
}

// ---------------------------------------------------------------------------
// 11) Limpieza y resumen
// ---------------------------------------------------------------------------
async function cleanup() {
  if (keepData) { console.log('\n🗂  --keep: datos de prueba conservados'); return; }
  try {
    const org = ADMIN.orgId;
    const tables = [
      'billing_payments', 'task_dependencies', 'task_tags', 'board_column_values', 'subtasks', 'task_comments', 'task_files', 'task_assignees', 'tasks',
      'board_columns', 'project_team', 'expenses', 'invoice_status_history', 'invoices', 'projects', 'monthly_sales_goals',
      'crm_activities', 'crm_deals', 'crm_pipeline_stages', 'notes', 'tags', 'notifications', 'activity_log', 'audit_log',
      'client_access_tokens', 'client_portal_settings', 'client_priorities', 'project_stages', 'clients',
      'user_session_tokens', 'team_session_tokens', 'team_invites', 'team_members',
    ];
    for (const t of tables) {
      try {
        const hasOrg = (await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='organization_id'`, [t])).rowCount > 0;
        if (hasOrg) await pool.query(`DELETE FROM ${t} WHERE organization_id = $1`, [org]);
        else if (t === 'user_session_tokens') await pool.query(`DELETE FROM ${t} WHERE current_org_id = $1`, [org]);
        else if (t === 'team_session_tokens') await pool.query(`DELETE FROM ${t} WHERE team_member_id IN (SELECT id FROM team_members WHERE organization_id = $1)`, [org]);
        else if (t === 'project_team') await pool.query(`DELETE FROM ${t} WHERE project_id IN (SELECT id FROM projects WHERE organization_id = $1)`, [org]);
        else if (t === 'invoice_status_history') await pool.query(`DELETE FROM ${t} WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id = $1)`, [org]);
        else if (t === 'task_dependencies' || t === 'task_tags' || t === 'board_column_values') await pool.query(`DELETE FROM ${t} WHERE task_id IN (SELECT id FROM tasks WHERE organization_id = $1)`, [org]);
      } catch { /* tabla/columna inexistente: ignorar */ }
    }
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [org]);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`role-%-${run}@test.local`]);
    console.log('\n🧹 Datos de prueba eliminados');
  } catch (e) {
    console.warn('\n⚠️  Limpieza incompleta:', e.message);
  }
}

await cleanup();
await pool.end();
if (serverProc) serverProc.kill('SIGTERM');

const passed = results.filter((r) => r.ok).length;
console.log(`\n${'='.repeat(70)}\n${failures === 0 ? '✅' : '❌'} Resultado: ${passed}/${results.length} comprobaciones OK, ${failures} fallidas\n${'='.repeat(70)}`);
if (failures) {
  console.log('\nFallos:');
  results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.label} ${r.detail ? `→ ${r.detail}` : ''}`));
}
process.exit(failures ? 1 : 0);
