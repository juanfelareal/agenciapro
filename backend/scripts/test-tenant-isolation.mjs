#!/usr/bin/env node
/**
 * Prueba automatizada de aislamiento multi-tenant (Orbit / AgenciaPro).
 *
 * Crea dos organizaciones (A y B) vía POST /api/auth/register, crea en cada una
 * un cliente, proyecto, tarea, subtarea, comentario, columna de tablero, etiqueta,
 * factura, gasto, nota, formulario, plantilla de documento y SOP; y luego, con el
 * token de B, intenta leer/editar/borrar cada recurso de A por id (GET/PUT/DELETE
 * de las rutas principales, incluidas /growth/clients/:id/financials,
 * /client-metrics/:id, /portal-admin/clients/:id/settings y /search?q=) exigiendo
 * 404/403, y comprueba que los listados de B no incluyen nada de A.
 * [billing] También: add-ons (/org/addons) y pagos (/org/billing/*): el checkout de A
 * no se ve desde B, y el webhook de Bold activa el plan anual de A con sus add-ons incluidos.
 *
 * USO (contra una base LOCAL de prueba, nunca producción):
 *
 *   createdb orbit_tenant_test            # una sola vez
 *   cd backend
 *   DATABASE_URL=postgres://localhost:5432/orbit_tenant_test \
 *     node scripts/test-tenant-isolation.mjs
 *
 * Opciones:
 *   --base http://localhost:3001   usa un servidor ya levantado (no arranca uno)
 *   --no-init                      no corre initializeDatabase() antes (asume esquema listo)
 *   --keep                         no borra los datos creados al final (para inspeccionar)
 *
 * Seguridad: aborta si DATABASE_URL no apunta a localhost/127.0.0.1 salvo que se
 * pase ALLOW_REMOTE_TEST_DB=1 (nunca lo uses contra la base de producción).
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
  console.error('\n❌ Falta DATABASE_URL.');
  console.error('   Crea una base local de prueba y pásala por variable de entorno, p. ej.:');
  console.error('     createdb orbit_tenant_test');
  console.error('     DATABASE_URL=postgres://localhost:5432/orbit_tenant_test node scripts/test-tenant-isolation.mjs\n');
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

// Que nada herede NODE_ENV=production (database.js activaría SSL)
process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'test' : (process.env.NODE_ENV || 'test');

// ---------------------------------------------------------------------------
// 1) Conexión y esquema
// ---------------------------------------------------------------------------
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
try {
  await pool.query('SELECT 1');
} catch (err) {
  console.error(`\n❌ No se pudo conectar a la base de prueba (${DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}).`);
  console.error(`   ${err.message}`);
  console.error('   ¿Existe la base? Créala con: createdb orbit_tenant_test\n');
  process.exit(1);
}

if (runInit) {
  console.log('🔧 Inicializando esquema con initializeDatabase()...');
  const { initializeDatabase } = await import('../src/config/database.js');
  // initializeDatabase es idempotente pero, en una base totalmente vacía, algunos
  // ALTER referencian tablas que se crean más abajo; se repite hasta que termine limpio.
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
const stamp = `tenant-${run}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  const port = 3900 + Math.floor(Math.random() * 100);
  base = `http://127.0.0.1:${port}`;
  console.log(`🚀 Arrancando backend de prueba en ${base} ...`);
  serverProc = spawn(process.execPath, ['server.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL,
      NODE_ENV: 'test',
      FRONTEND_URL: base,
      // Evitar efectos externos durante la prueba
      RESEND_API_KEY: '', SMTP_HOST: '', KAPSO_API_KEY: '', ANTHROPIC_API_KEY: '', BLOB_READ_WRITE_TOKEN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false;
  let output = '';
  const serverLog = process.env.TENANT_TEST_SERVER_LOG || path.join(os.tmpdir(), `orbit-tenant-test-server-${run}.log`);
  const logStream = fs.createWriteStream(serverLog);
  console.log(`   (log del servidor: ${serverLog})`);
  serverProc.stdout.on('data', (d) => {
    const s = d.toString();
    output += s; logStream.write(s);
    if (s.includes('Database schema ready') || s.includes('Application fully operational') || s.includes('Application operational')) ready = true;
  });
  serverProc.stderr.on('data', (d) => { output += d.toString(); logStream.write(d); });
  serverProc.on('exit', (code) => { if (!ready) { console.error('❌ El servidor terminó antes de estar listo. Salida:\n' + output.slice(-4000)); process.exit(1); } });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (ready) {
      try { const r = await fetch(`${base}/api/health`); if (r.ok) break; } catch { /* retry */ }
    }
    await sleep(500);
  }
  if (!ready) {
    console.error('❌ Timeout esperando al servidor. Salida:\n' + output.slice(-4000));
    process.exit(1);
  }
  // initializeDatabase se ejecuta otra vez dentro del server (idempotente); dar un respiro
  await sleep(1500);
  console.log('✅ Servidor listo\n');
}

if (!base) await startServer();

// ---------------------------------------------------------------------------
// 3) Utilidades HTTP y de aserción
// ---------------------------------------------------------------------------
const results = [];
let failures = 0;

async function api(method, url, { token, body, raw = false } = {}) {
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

/** Espera 404 o 403 (acceso cruzado denegado sin revelar existencia). */
async function expectDenied(method, url, token, body) {
  const r = await api(method, url, { token, body });
  const ok = r.status === 404 || r.status === 403;
  record(ok, `${method.padEnd(6)} ${url}`, ok ? `${r.status}` : `recibió ${r.status}: ${String(r.raw).slice(0, 160)}`);
  return r;
}

/** Espera 2xx. */
async function expectOk(method, url, token, body, label) {
  const r = await api(method, url, { token, body });
  const ok = r.status >= 200 && r.status < 300;
  record(ok, label || `${method.padEnd(6)} ${url}`, ok ? `${r.status}` : `recibió ${r.status}: ${String(r.raw).slice(0, 200)}`);
  if (!ok) throw new Error(`Fallo creando/consultando ${method} ${url}: ${r.status} ${r.raw}`);
  return r.data;
}

const collectIds = (payload) => {
  const ids = new Set();
  const walk = (v, depth = 0) => {
    if (depth > 6 || v == null) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    if (typeof v === 'object') {
      if (typeof v.id === 'number') ids.add(v.id);
      Object.values(v).forEach((x) => walk(x, depth + 1));
    }
  };
  walk(payload);
  return ids;
};

// ---------------------------------------------------------------------------
// 4) Registro de dos organizaciones
// ---------------------------------------------------------------------------

async function registerOrg(tag) {
  const r = await api('POST', '/auth/register', {
    body: { name: `Admin ${tag} ${run}`, email: `admin-${tag}-${run}@test.local`, pin: '1234', org_name: `Org ${tag} ${run}` },
  });
  if (r.status !== 201) throw new Error(`register ${tag} falló: ${r.status} ${r.raw}`);
  return { token: r.data.token, orgId: r.data.current_org.id, memberId: r.data.user.id, current_org: r.data.current_org };
}

console.log('👥 Registrando organizaciones A y B...');
const A = await registerOrg('A');
const B = await registerOrg('B');
record(A.orgId !== B.orgId, 'Las dos organizaciones tienen ids distintos', `A=${A.orgId} B=${B.orgId}`);

// Plan trial + trial_ends_at
{
  const org = (await pool.query('SELECT plan, trial_ends_at FROM organizations WHERE id = $1', [A.orgId])).rows[0];
  const ends = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const days = ends ? Math.round((ends - Date.now()) / 86400000) : null;
  record(org?.plan === 'trial' && days !== null && days >= 13 && days <= 14, 'Org nueva: plan=trial y trial_ends_at ≈ now + 14 días', `plan=${org?.plan} días=${days}`);
}

// Org nueva arranca vacía (ningún dato de otra org)
{
  const checks = [
    ['clients', 'organization_id'], ['projects', 'organization_id'], ['tasks', 'organization_id'], ['invoices', 'organization_id'],
    ['notes', 'organization_id'], ['forms', 'organization_id'], ['document_templates', 'organization_id'], ['sops', 'organization_id'],
    ['ugc_creators', 'organization_id'], ['ugc_packages', 'organization_id'], ['dashboard_templates', 'organization_id'],
  ];
  let total = 0; const nonEmpty = [];
  for (const [table, col] of checks) {
    try {
      const n = Number((await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${col} = $1`, [B.orgId])).rows[0].n);
      total += n; if (n) nonEmpty.push(`${table}=${n}`);
    } catch { /* tabla inexistente */ }
  }
  record(total === 0, 'Org nueva arranca vacía (sin clientes, proyectos, facturas, notas, UGC, plantillas...)', nonEmpty.join(', ') || 'ok');
}

// Token de B no sirve para la org A (select-org)
{
  const r = await api('POST', '/auth/select-org', { token: B.token, body: { org_id: A.orgId } });
  record(r.status === 403 || r.status === 404, 'B no puede cambiarse a la organización A (select-org)', `${r.status}`);
}

// ---------------------------------------------------------------------------
// 5) Datos de prueba en cada organización
// ---------------------------------------------------------------------------
async function seedOrg(T, tag) {
  const d = {};
  const name = `${stamp}-${tag}`;
  d.client = await expectOk('POST', '/clients', T.token, { name: `Cliente ${name}`, company: `Empresa ${name}`, email: `c-${tag}-${run}@test.local` }, `[${tag}] crear cliente`);
  d.clientId = d.client.id ?? d.client.client?.id;
  d.project = await expectOk('POST', '/projects', T.token, { name: `Proyecto ${name}`, client_id: d.clientId }, `[${tag}] crear proyecto`);
  d.task = await expectOk('POST', '/tasks', T.token, { title: `Tarea ${name}`, project_id: d.project.id, status: 'todo', priority: 'medium' }, `[${tag}] crear tarea`);
  d.subtask = await expectOk('POST', '/subtasks', T.token, { task_id: d.task.id, title: `Subtarea ${name}` }, `[${tag}] crear subtarea`);
  d.comment = await expectOk('POST', '/task-comments', T.token, { task_id: d.task.id, user_id: T.memberId, comment: `Comentario ${name}` }, `[${tag}] crear comentario`);
  d.column = await expectOk('POST', '/board-columns', T.token, { project_id: d.project.id, column_name: `Col ${name}`, column_type: 'text' }, `[${tag}] crear columna de tablero`);
  d.tag = await expectOk('POST', '/tags', T.token, { name: `Tag ${name}`, color: '#123456' }, `[${tag}] crear etiqueta`);
  d.invoice = await expectOk('POST', '/invoices', T.token, { client_id: d.clientId, project_id: d.project.id, amount: 1000, issue_date: '2026-01-15', notes: `Factura ${name}` }, `[${tag}] crear factura`);
  d.expense = await expectOk('POST', '/expenses', T.token, { description: `Gasto ${name}`, amount: 500, expense_date: '2026-01-15', category: 'other', project_id: d.project.id }, `[${tag}] crear gasto`);
  d.note = await expectOk('POST', '/notes', T.token, { title: `Nota ${name}`, content_plain: `contenido ${name}`, links: [{ client_id: d.clientId }] }, `[${tag}] crear nota`);
  d.form = await expectOk('POST', '/forms', T.token, { title: `Form ${name}`, sections: [{ title: 'S1', fields: [{ label: 'Campo', field_type: 'short_text' }] }] }, `[${tag}] crear formulario`);
  d.docTemplate = await expectOk('POST', '/document-templates', T.token, { name: `Doc ${name}`, content: `<p>${name}</p>`, category: 'nda' }, `[${tag}] crear plantilla de documento`);
  d.sop = await expectOk('POST', '/sops', T.token, { title: `SOP ${name}`, content: `contenido ${name}` }, `[${tag}] crear SOP`);
  d.formAssign = await api('POST', `/forms/${d.form.id}/assign`, { token: T.token, body: { client_id: d.clientId } });
  return d;
}

console.log('\n📦 Creando datos en la organización A...');
const a = await seedOrg(A, 'A');
console.log('\n📦 Creando datos en la organización B...');
const b = await seedOrg(B, 'B');

// ---------------------------------------------------------------------------
// 6) Con el token de B: intentar leer/editar los recursos de A
// ---------------------------------------------------------------------------
console.log('\n🔒 B intenta LEER recursos de A por id (debe ser 404/403)...');
const tB = B.token;
const reads = [
  `/clients/${a.clientId}`,
  `/projects/${a.project.id}`,
  `/tasks/${a.task.id}`,
  `/subtasks/${a.subtask.id}`,
  `/subtasks/task/${a.task.id}`,
  `/subtasks/task/${a.task.id}/progress`,
  `/task-comments/task/${a.task.id}`,
  `/board-columns/${a.column.id}`,
  `/board-columns/project/${a.project.id}`,
  `/board-columns/values/task/${a.task.id}`,
  `/tags/${a.tag.id}`,
  `/tags/task/${a.task.id}`,
  `/invoices/${a.invoice.id}`,
  `/invoices/${a.invoice.id}/history`,
  `/expenses/${a.expense.id}`,
  `/notes/${a.note.id}`,
  `/notes/${a.note.id}/versions`,
  `/notes/client/${a.clientId}`,
  `/notes/project/${a.project.id}`,
  `/forms/${a.form.id}`,
  `/forms/${a.form.id}/assignments`,
  `/forms/client/${a.clientId}`,
  `/document-templates/${a.docTemplate.id}`,
  `/document-templates/signatures/client/${a.clientId}`,
  `/sops/${a.sop.id}`,
  `/sops/${a.sop.id}/revisions`,
  `/growth/${a.clientId}`,
  `/growth/clients/${a.clientId}/financials?period=2026-01`,
  `/growth/clients/${a.clientId}/fixed-costs`,
  `/growth/clients/${a.clientId}/commission`,
  `/client-metrics/${a.clientId}?start_date=2026-01-01&end_date=2026-01-31`,
  `/client-metrics/${a.clientId}/daily?start_date=2026-01-01&end_date=2026-01-31`,
  `/client-metrics/${a.clientId}/ads?start_date=2026-01-01&end_date=2026-01-31`,
  `/portal-admin/clients/${a.clientId}/settings`,
  `/portal-admin/clients/${a.clientId}/access`,
  `/portal-admin/clients/${a.clientId}/activity`,
  `/portal-admin/priorities/${a.clientId}`,
  `/task-history/task/${a.task.id}`,
  `/task-dependencies/task/${a.task.id}`,
  `/task-files/task/${a.task.id}`,
  `/client-documents/${a.clientId}`,
  `/client-calls/${a.clientId}`,
  `/client-logbook/${a.clientId}`,
  `/client-reports/${a.clientId}`,
  `/platform-credentials/client/${a.clientId}`,
  `/email-marketing/${a.clientId}`,
  `/whatsapp-sales/${a.clientId}`,
  `/collections/client/${a.clientId}`,
  `/structured-briefs/client/${a.clientId}`,
];
for (const url of reads) await expectDenied('GET', url, tB);

console.log('\n🔒 B intenta EDITAR recursos de A (debe ser 404/403)...');
await expectDenied('PUT', `/clients/${a.clientId}`, tB, { name: 'Hack', company: 'Hack' });
await expectDenied('PUT', `/clients/${a.clientId}/visibility`, tB, { visible_to_member_ids: [] });
await expectDenied('PUT', `/projects/${a.project.id}`, tB, { name: 'Hack' });
await expectDenied('POST', `/projects/${a.project.id}/team`, tB, { team_member_id: B.memberId });
await expectDenied('PUT', `/tasks/${a.task.id}`, tB, { title: 'Hack', status: 'done' });
await expectDenied('PUT', `/subtasks/${a.subtask.id}`, tB, { title: 'Hack' });
await expectDenied('PUT', `/subtasks/${a.subtask.id}/toggle`, tB, {});
await expectDenied('PUT', `/subtasks/reorder/${a.task.id}`, tB, { subtaskIds: [a.subtask.id] });
await expectDenied('PUT', `/task-comments/${a.comment.id}`, tB, { comment: 'Hack' });
await expectDenied('PUT', `/board-columns/${a.column.id}`, tB, { column_name: 'Hack' });
await expectDenied('POST', `/board-columns/values`, tB, { task_id: a.task.id, column_id: a.column.id, value: 'Hack' });
await expectDenied('PUT', `/tags/${a.tag.id}`, tB, { name: 'Hack' });
await expectDenied('POST', `/tags/task/${a.task.id}/tag/${b.tag.id}`, tB);
await expectDenied('POST', `/tags/task/${b.task.id}/tag/${a.tag.id}`, tB);
await expectDenied('PUT', `/invoices/${a.invoice.id}`, tB, { status: 'paid', amount: 1 });
await expectDenied('POST', `/invoices/${a.invoice.id}/duplicate`, tB);
await expectDenied('PUT', `/expenses/${a.expense.id}`, tB, { description: 'Hack', amount: 1, expense_date: '2026-01-01' });
await expectDenied('PUT', `/notes/${a.note.id}`, tB, { title: 'Hack' });
await expectDenied('PUT', `/notes/${a.note.id}/pin`, tB, { is_pinned: true });
await expectDenied('POST', `/notes/${a.note.id}/links`, tB, { client_id: b.clientId });
await expectDenied('PUT', `/forms/${a.form.id}`, tB, { title: 'Hack', status: 'draft', sections: [] });
await expectDenied('POST', `/forms/${a.form.id}/assign`, tB, { client_id: b.clientId });
await expectDenied('POST', `/forms/${a.form.id}/share`, tB, {});
await expectDenied('POST', `/forms/${a.form.id}/duplicate`, tB);
await expectDenied('PUT', `/document-templates/${a.docTemplate.id}`, tB, { name: 'Hack', content: 'x' });
await expectDenied('POST', `/document-templates/${a.docTemplate.id}/assign/${b.clientId}`, tB, {});
await expectDenied('POST', `/document-templates/${b.docTemplate.id}/assign/${a.clientId}`, tB, {});
await expectDenied('PUT', `/sops/${a.sop.id}`, tB, { title: 'Hack' });
await expectDenied('PUT', `/growth/clients/${a.clientId}/settings`, tB, { default_cogs_rate: 0.5 });
await expectDenied('POST', `/growth/${a.clientId}/objectives`, tB, { period: '2026-01', metric: 'revenue', base: 1 });
await expectDenied('POST', `/growth/clients/${a.clientId}/fixed-costs`, tB, { name: 'Hack', amount: 1 });
await expectDenied('PUT', `/portal-admin/clients/${a.clientId}/settings`, tB, { can_view_projects: false, welcome_message: 'Hack' });
await expectDenied('POST', `/portal-admin/clients/${a.clientId}/invite`, tB, {});
await expectDenied('PUT', `/portal-admin/priorities/${a.clientId}`, tB, { priorities: [] });
await expectDenied('POST', `/client-metrics/sync/${a.clientId}`, tB, {});

console.log('\n🔒 B intenta CREAR recursos colgando de padres de A (debe ser 404/403)...');
await expectDenied('POST', `/projects`, tB, { name: 'Hack', client_id: a.clientId });
await expectDenied('POST', `/tasks`, tB, { title: 'Hack', project_id: a.project.id });
await expectDenied('POST', `/subtasks`, tB, { task_id: a.task.id, title: 'Hack' });
await expectDenied('POST', `/task-comments`, tB, { task_id: a.task.id, user_id: B.memberId, comment: 'Hack' });
await expectDenied('POST', `/task-comments`, tB, { task_id: b.task.id, user_id: A.memberId, comment: 'Hack (autor de A)' });
await expectDenied('POST', `/board-columns`, tB, { project_id: a.project.id, column_name: 'Hack', column_type: 'text' });
await expectDenied('POST', `/invoices`, tB, { client_id: a.clientId, amount: 1, issue_date: '2026-01-01' });
await expectDenied('POST', `/expenses`, tB, { description: 'Hack', amount: 1, expense_date: '2026-01-01', project_id: a.project.id });
await expectDenied('POST', `/notes`, tB, { title: 'Hack', links: [{ client_id: a.clientId }] });
await expectDenied('POST', `/task-dependencies`, tB, { task_id: b.task.id, depends_on_task_id: a.task.id });
await expectDenied('PUT', `/tasks/${b.task.id}`, tB, { project_id: a.project.id });

console.log('\n🔒 B intenta BORRAR recursos de A (debe ser 404/403)...');
await expectDenied('DELETE', `/task-comments/${a.comment.id}`, tB);
await expectDenied('DELETE', `/subtasks/${a.subtask.id}`, tB);
await expectDenied('DELETE', `/board-columns/${a.column.id}`, tB);
await expectDenied('DELETE', `/tags/${a.tag.id}`, tB);
await expectDenied('DELETE', `/tasks/${a.task.id}`, tB);
await expectDenied('DELETE', `/projects/${a.project.id}/team/${A.memberId}`, tB);
await expectDenied('DELETE', `/projects/${a.project.id}`, tB);
await expectDenied('DELETE', `/invoices/${a.invoice.id}`, tB);
await expectDenied('DELETE', `/expenses/${a.expense.id}`, tB);
await expectDenied('DELETE', `/notes/${a.note.id}`, tB);
await expectDenied('DELETE', `/forms/${a.form.id}`, tB);
await expectDenied('DELETE', `/document-templates/${a.docTemplate.id}`, tB);
await expectDenied('DELETE', `/sops/${a.sop.id}`, tB);
await expectDenied('DELETE', `/clients/${a.clientId}`, tB);

// ---------------------------------------------------------------------------
// 7) Listados y búsqueda de B no incluyen nada de A
// ---------------------------------------------------------------------------
console.log('\n📋 Listados de B no deben incluir recursos de A...');
const lists = [
  ['/clients', a.clientId],
  ['/projects', a.project.id],
  ['/tasks', a.task.id],
  ['/invoices', a.invoice.id],
  ['/expenses', a.expense.id],
  ['/notes', a.note.id],
  ['/forms', a.form.id],
  ['/document-templates', a.docTemplate.id],
  ['/sops', a.sop.id],
  ['/tags', a.tag.id],
  ['/growth/clients', a.clientId],
  ['/client-metrics/summary/all', a.clientId],
  ['/portal-admin/commercial-dates', a.clientId],
  ['/document-templates/signatures/all', a.clientId],
  ['/team', A.memberId],
];
for (const [url, foreignId] of lists) {
  const r = await api('GET', url, { token: tB });
  const ok2xx = r.status >= 200 && r.status < 300;
  const text = r.raw || '';
  const containsStamp = text.includes(`${stamp}-A`);
  const ids = collectIds(r.data);
  // Para listados de entidades, el id de A no debe aparecer como `id` de una fila con el nombre de A
  const leaked = containsStamp || (url !== '/team' && url !== '/tags' && ids.has(foreignId) && containsStamp);
  record(ok2xx && !leaked, `GET    ${url} (sin datos de A)`, ok2xx ? (leaked ? 'contiene datos de A' : `${r.status}, ${Array.isArray(r.data) ? r.data.length : 'obj'} filas`) : `recibió ${r.status}`);
}

{
  const r = await api('GET', `/search?q=${encodeURIComponent(stamp + '-A')}`, { token: tB });
  // La respuesta hace eco de `query`: miramos solo `results`
  const leaked = JSON.stringify(r.data?.results || {}).includes(`${stamp}-A`);
  record(r.status === 200 && !leaked, `GET    /search?q=${stamp}-A (B no ve nada de A)`, leaked ? 'devolvió resultados de A' : `${r.status}`);
  const r2 = await api('GET', `/search/quick?q=${encodeURIComponent(stamp + '-A')}`, { token: tB });
  record(r2.status === 200 && !(r2.raw || '').includes(`${stamp}-A`), `GET    /search/quick?q=${stamp}-A (B no ve nada de A)`, `${r2.status}`);
  const r3 = await api('GET', `/notes/search/query?q=${encodeURIComponent(stamp + '-A')}`, { token: tB });
  record(r3.status === 200 && !(r3.raw || '').includes(`${stamp}-A`), `GET    /notes/search/query?q=${stamp}-A (B no ve nada de A)`, `${r3.status}`);
  // La búsqueda de A sí debe encontrar lo suyo (control positivo)
  const r4 = await api('GET', `/search?q=${encodeURIComponent(stamp + '-A')}`, { token: A.token });
  record(r4.status === 200 && JSON.stringify(r4.data?.results || {}).includes(`${stamp}-A`), `GET    /search?q=${stamp}-A con token de A encuentra sus datos (control)`, `${r4.status}`);
}

// ---------------------------------------------------------------------------
// 8) Control: los recursos de A siguen intactos tras los intentos de B
// ---------------------------------------------------------------------------
console.log('\n🧪 Control: A sigue viendo sus recursos intactos...');
const intact = [
  [`/clients/${a.clientId}`, (d) => (d.company || d.client?.company || '').includes(`${stamp}-A`)],
  [`/projects/${a.project.id}`, (d) => d.name?.includes(`${stamp}-A`)],
  [`/tasks/${a.task.id}`, (d) => d.title?.includes(`${stamp}-A`) && d.status !== 'done'],
  [`/subtasks/${a.subtask.id}`, (d) => d.title?.includes(`${stamp}-A`)],
  [`/board-columns/${a.column.id}`, (d) => d.column_name?.includes(`${stamp}-A`)],
  [`/tags/${a.tag.id}`, (d) => d.name?.includes(`${stamp}-A`)],
  [`/invoices/${a.invoice.id}`, (d) => Number(d.amount) === 1000],
  [`/expenses/${a.expense.id}`, (d) => d.description?.includes(`${stamp}-A`)],
  [`/notes/${a.note.id}`, (d) => d.title?.includes(`${stamp}-A`)],
  [`/forms/${a.form.id}`, (d) => d.title?.includes(`${stamp}-A`)],
  [`/document-templates/${a.docTemplate.id}`, (d) => d.name?.includes(`${stamp}-A`)],
  [`/sops/${a.sop.id}`, (d) => d.title?.includes(`${stamp}-A`)],
  [`/portal-admin/clients/${a.clientId}/settings`, (d) => (d.welcome_message || d.settings?.welcome_message || '') !== 'Hack'],
];
for (const [url, check] of intact) {
  const r = await api('GET', url, { token: A.token });
  const ok = r.status === 200 && check(r.data || {});
  record(ok, `GET    ${url} (token A, intacto)`, ok ? '200' : `recibió ${r.status}: ${String(r.raw).slice(0, 120)}`);
}
{
  const r = await api('GET', `/task-comments/task/${a.task.id}`, { token: A.token });
  const list = Array.isArray(r.data) ? r.data : (r.data?.comments || []);
  record(r.status === 200 && list.some((c) => c.id === a.comment.id && c.comment?.includes(`${stamp}-A`)), `GET    /task-comments/task/${a.task.id} (token A, comentario intacto)`, `${r.status}`);
}
{
  const r = await api('GET', `/tags/task/${b.task.id}`, { token: B.token });
  const list = Array.isArray(r.data) ? r.data : [];
  record(r.status === 200 && !list.some((t) => t.id === a.tag.id), 'La tarea de B no quedó etiquetada con la etiqueta de A', `${r.status}`);
}


// ---------------------------------------------------------------------------
// 8b) [billing] Add-ons y pagos: aislamiento entre organizaciones
// ---------------------------------------------------------------------------
console.log('\n💳 Add-ons y pagos (billing)...');
{
  // Add-ons: la prueba se comporta como Growth → hourly_reports permitido; extra_users suma al límite
  const r0 = await api('GET', '/org/plan', { token: A.token });
  record(r0.status === 200 && r0.data?.billing_cycle === 'monthly' && r0.data?.addons && Array.isArray(r0.data?.addons_included) && Array.isArray(r0.data?.catalog?.addons),
    'GET    /org/plan trae billing_cycle, addons, addons_included y catalog.addons', `${r0.status}`);
  const baseUsers = r0.data?.limits?.users;

  const r1 = await api('PUT', '/org/addons', { token: A.token, body: { addons: { hourly_reports: true, extra_users: 2 } } });
  record(r1.status === 200 && r1.data?.addons?.hourly_reports === true && r1.data?.addons?.extra_users === 2 && (baseUsers == null || r1.data?.limits?.users === baseUsers + 2),
    'PUT    /org/addons (A) activa hourly_reports y suma 2 usuarios al límite', `${r1.status} limits=${JSON.stringify(r1.data?.limits)}`);

  const r2 = await api('PUT', '/org/addons', { token: A.token, body: { addons: { extra_users: -1 } } });
  record(r2.status === 400, 'PUT    /org/addons con entero negativo → 400', `${r2.status}`);
  const r3 = await api('PUT', '/org/addons', { token: A.token, body: { addons: { nope: true } } });
  record(r3.status === 400, 'PUT    /org/addons con add-on desconocido → 400', `${r3.status}`);

  // B no hereda nada de A
  const rb = await api('GET', '/org/addons', { token: B.token });
  record(rb.status === 200 && rb.data?.addons?.hourly_reports === false && rb.data?.addons?.extra_users === 0,
    'GET    /org/addons (B) no refleja los add-ons de A', `${rb.status}`);

  // Starter: hourly_reports no está en el plan → 402 con required_plan
  await pool.query(`UPDATE organizations SET plan = 'starter', plan_status = 'active', trial_ends_at = NULL WHERE id = $1`, [B.orgId]);
  await api('PUT', '/org/modules', { token: B.token, body: { modules: {} } }); // escribe → invalida la caché del plan (30 s) en el servidor
  const r4 = await api('PUT', '/org/addons', { token: B.token, body: { addons: { hourly_reports: true } } });
  const r4ok = r4.status === 402 && r4.data?.upgrade === true && r4.data?.required_plan === 'growth';
  record(r4ok, 'PUT    /org/addons (B en Starter) hourly_reports → 402 upgrade required_plan=growth', r4ok ? '402' : `recibió ${r4.status}: ${String(r4.raw).slice(0, 120)}`);

  // Checkout manual (sin BOLD_API_KEY en la prueba) y pagos
  const c1 = await api('POST', '/org/billing/checkout', { token: A.token, body: { plan: 'growth', cycle: 'annual' } });
  const c1ok = c1.status === 201 && c1.data?.provider === 'manual' && c1.data?.amount === 4890000 && c1.data?.iva === 929100 && c1.data?.total === 5819100 && /^orb_\d+_\d+_[0-9a-f]+$/.test(c1.data?.reference || '');
  record(c1ok, 'POST   /org/billing/checkout (A, growth anual) → manual, 4.890.000 + IVA 929.100 = 5.819.100', c1ok ? '201' : `recibió ${c1.status}: ${String(c1.raw).slice(0, 160)}`);
  const refA = c1.data?.reference;

  const c2 = await api('POST', '/org/billing/checkout', { token: A.token, body: { plan: 'nope', cycle: 'annual' } });
  record(c2.status === 400, 'POST   /org/billing/checkout con plan inválido → 400', `${c2.status}`);

  const l1 = await api('GET', '/org/billing/payments', { token: A.token });
  record(l1.status === 200 && (l1.data?.payments || []).some((p) => p.reference === refA), 'GET    /org/billing/payments (A) lista su pago', `${l1.status}`);
  const l2 = await api('GET', '/org/billing/payments', { token: B.token });
  record(l2.status === 200 && !(l2.data?.payments || []).some((p) => p.reference === refA), 'GET    /org/billing/payments (B) no ve el pago de A', `${l2.status}`);
  const s1 = await api('GET', `/org/billing/status?reference=${encodeURIComponent(refA)}`, { token: B.token });
  record(s1.status === 404, 'GET    /org/billing/status?reference=<pago de A> con token B → 404', `${s1.status}`);
  const s2 = await api('GET', `/org/billing/status?reference=${encodeURIComponent(refA)}`, { token: A.token });
  record(s2.status === 200 && s2.data?.payment?.status === 'pending', 'GET    /org/billing/status (A) → pending', `${s2.status}`);

  // Webhook de Bold (sin secreto → aceptado fuera de producción): activa el plan anual de A
  const event = { id: `evt-${run}`, type: 'SALE_APPROVED', subject: `pay-${run}`, source: '/payments', time: Date.now() * 1e6,
    data: { payment_id: `pay-${run}`, amount: { currency: 'COP', total: 5819100, taxes: [{ type: 'VAT', base: 4890000, value: 929100 }], tip: 0 }, metadata: { reference: refA }, payment_method: 'PSE', payer_email: `admin-A-${run}@test.local` } };
  const w = await fetch(`${base}/api/webhooks/bold`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
  const wd = await w.json().catch(() => ({}));
  record(w.status === 200 && wd?.status === 'approved', 'POST   /api/webhooks/bold SALE_APPROVED → approved', `${w.status} ${JSON.stringify(wd).slice(0, 120)}`);
  const w2 = await fetch(`${base}/api/webhooks/bold`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
  const wd2 = await w2.json().catch(() => ({}));
  record(w2.status === 200 && wd2?.duplicate === true, 'POST   /api/webhooks/bold repetido → idempotente (duplicate)', `${w2.status}`);

  const orgA = (await pool.query('SELECT plan, plan_status, billing_cycle, plan_renews_at, price_locked_until, plan_price_locked, trial_ends_at FROM organizations WHERE id = $1', [A.orgId])).rows[0];
  const months = orgA?.plan_renews_at ? Math.round((new Date(orgA.plan_renews_at) - Date.now()) / (30.4 * 86400000)) : null;
  record(orgA?.plan === 'growth' && orgA?.plan_status === 'active' && orgA?.billing_cycle === 'annual' && months === 12 && orgA?.plan_price_locked === 489000 && orgA?.trial_ends_at === null && !!orgA?.price_locked_until,
    'Org A activada: growth / active / annual / renueva en 12 meses / precio congelado', JSON.stringify({ plan: orgA?.plan, status: orgA?.plan_status, cycle: orgA?.billing_cycle, months, locked: orgA?.plan_price_locked }));

  const pA = await api('GET', '/org/plan', { token: A.token });
  const inc = pA.data?.addons_included || [];
  record(pA.status === 200 && pA.data?.billing_cycle === 'annual' && inc.includes('hourly_reports') && inc.includes('owner_reports') && pA.data?.addons?.owner_reports === true,
    'GET    /org/plan (A) muestra addons_included del anual (hourly_reports, owner_reports)', `${pA.status} included=${inc.join(',')}`);
  const off = await api('PUT', '/org/addons', { token: A.token, body: { addons: { owner_reports: false } } });
  record(off.status === 400 && off.data?.included === true, 'PUT    /org/addons (A anual) apagar add-on incluido → 400', `${off.status}`);
  const pB = await api('GET', '/org/plan', { token: B.token });
  record(pB.status === 200 && pB.data?.billing_cycle === 'monthly' && (pB.data?.addons_included || []).length === 0, 'GET    /org/plan (B) sigue mensual y sin add-ons incluidos', `${pB.status}`);
}

// ---------------------------------------------------------------------------
// 9) Limpieza y resumen
// ---------------------------------------------------------------------------
async function cleanup() {
  if (keepData) { console.log('\n🗂  --keep: datos de prueba conservados'); return; }
  try {
    for (const org of [A.orgId, B.orgId]) {
      // Borrar en orden hijo → padre lo que no tenga ON DELETE CASCADE
      const tables = [
        'billing_payments', 'task_dependencies', 'task_tags', 'board_column_values', 'subtasks', 'task_comments', 'task_files', 'task_assignees', 'tasks',
        'board_columns', 'project_team', 'expenses', 'invoice_status_history', 'invoices', 'projects',
        'note_links', 'note_versions', 'notes', 'form_fields', 'form_sections', 'form_assignments', 'forms',
        'document_signatures', 'document_templates', 'sop_revisions', 'sops', 'tags', 'notifications', 'activity_log', 'audit_log',
        'client_access_tokens', 'client_portal_settings', 'client_priorities', 'project_stages', 'clients',
        'user_session_tokens', 'team_session_tokens', 'team_members',
      ];
      for (const t of tables) {
        try {
          const hasOrg = (await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='organization_id'`, [t])).rowCount > 0;
          if (hasOrg) await pool.query(`DELETE FROM ${t} WHERE organization_id = $1`, [org]);
          else if (t === 'user_session_tokens') await pool.query(`DELETE FROM ${t} WHERE current_org_id = $1`, [org]);
          else if (t === 'invoice_status_history') await pool.query(`DELETE FROM ${t} WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id = $1)`, [org]);
          else if (t === 'task_dependencies' || t === 'task_tags' || t === 'board_column_values') await pool.query(`DELETE FROM ${t} WHERE task_id IN (SELECT id FROM tasks WHERE organization_id = $1)`, [org]);
          else if (t === 'note_links') await pool.query(`DELETE FROM ${t} WHERE note_id IN (SELECT id FROM notes WHERE organization_id = $1)`, [org]);
          else if (t === 'form_fields') await pool.query(`DELETE FROM ${t} WHERE section_id IN (SELECT s.id FROM form_sections s JOIN forms f ON f.id = s.form_id WHERE f.organization_id = $1)`, [org]);
          else if (t === 'form_sections') await pool.query(`DELETE FROM ${t} WHERE form_id IN (SELECT id FROM forms WHERE organization_id = $1)`, [org]);
          else if (t === 'sop_revisions') await pool.query(`DELETE FROM ${t} WHERE sop_id IN (SELECT id FROM sops WHERE organization_id = $1)`, [org]);
        } catch (e) { /* tabla/columna inexistente: ignorar */ }
      }
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [org]);
    }
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`admin-%-${run}@test.local`]);
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
