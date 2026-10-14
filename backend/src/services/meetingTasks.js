/**
 * Reuniones → tareas.
 *
 * Un miembro del equipo envía la transcripción (texto o archivo de Tactiq) al número de WhatsApp
 * de LA REAL, o la pega en Orbit. Claude extrae los compromisos (qué, quién, cliente, cuándo),
 * Orbit responde con una propuesta numerada, la persona corrige en lenguaje natural o confirma,
 * y con el OK se crean las tareas en Orbit con responsable, cliente y fecha.
 *
 * Tabla: meeting_intakes (status: proposed | confirmed | cancelled | failed).
 */
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { createRequire } from 'module';
import db from '../config/database.js';
import { notifyTaskAssigned } from '../utils/notificationHelper.js';
import { getKapsoConfig, phoneTail, normalizeWaNumber } from '../utils/kapsoClient.js';

const require = createRequire(import.meta.url);
const MODEL = process.env.MEETING_TASKS_MODEL || 'claude-sonnet-4-6';
const TZ = 'America/Bogota';
const todayColombia = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const anthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Proveedor de IA sin costo: Google Gemini (AI Studio) tiene nivel gratuito sin tarjeta y
 * contexto de 1M tokens, suficiente para una reunión de 2-3 horas. Si hay GEMINI_API_KEY se usa
 * primero; si no, Anthropic (de pago); si no hay ninguna, la heurística sin IA.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const hasGemini = () => Boolean((process.env.GEMINI_API_KEY || '').trim()) && !/^your-/i.test(process.env.GEMINI_API_KEY || '');
const hasAnthropic = () => /^sk-ant-/.test(process.env.ANTHROPIC_API_KEY || '');
export const aiProvider = () => (hasGemini() ? `gemini:${GEMINI_MODEL}` : hasAnthropic() ? `anthropic:${MODEL}` : null);

async function callLLM(prompt, maxTokens) {
  if (hasGemini()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const res = await axios.post(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
    }, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY.trim(), 'Content-Type': 'application/json' }, timeout: 180000 });
    const parts = res.data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('\n');
    if (!text) throw new Error(`Gemini no devolvió texto (${res.data?.candidates?.[0]?.finishReason || 'sin candidatos'})`);
    return { text, usage: res.data?.usageMetadata || null };
  }
  if (hasAnthropic()) {
    const res = await anthropic().messages.create({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
    return { text: res.content?.map((c) => c.text || '').join('\n'), usage: res.usage };
  }
  throw new Error('Sin proveedor de IA configurado');
}

// Apodos habituales del equipo (se suman a lo que Claude infiere por nombre/cargo)
const DEFAULT_ALIASES = {
  'juan felipe': ['juanfe', 'juan felipe', 'jf', 'felipe'],
  'juan david': ['juancho', 'juan david', 'juanda'],
  'maria fernanda': ['mafe', 'maria fernanda', 'mariafe'],
  'maria paula': ['mapau', 'maria paula', 'pau'],
  'laura': ['lau', 'laura'],
  'valentina': ['vale', 'valentina', 'valen'],
  'sofía': ['sofi', 'sofía', 'sofia'],
  'santiago': ['santi', 'santiago', 'upegui'],
  'jose': ['jose', 'josé', 'roa', 'jose roa'],
};

const COMPOUND_FIRST = new Set(['maria', 'juan', 'jose', 'ana', 'luis', 'luisa']);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ---------------------------------------------------------------------------
// Equipo y clientes
// ---------------------------------------------------------------------------
export async function findTeamMemberByPhone(orgId, phone) {
  const tail = phoneTail(phone);
  if (!tail || tail.length < 7) return null;
  return db.get(`
    SELECT id, name, email, role, position FROM team_members
    WHERE organization_id = ? AND status = 'active' AND phone IS NOT NULL
      AND RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ?
    LIMIT 1
  `, [orgId, tail]);
}

/** "soy Santiago" → asocia el número al miembro del equipo que mejor coincide por nombre */
export async function registerTeamPhoneByName(orgId, nameGuess, phone) {
  const members = await db.all("SELECT id, name FROM team_members WHERE organization_id = ? AND status = 'active'", [orgId]);
  const g = norm(nameGuess);
  if (!g) return null;
  const score = (m) => {
    const n = norm(m.name);
    if (n === g) return 100;
    if (n.startsWith(g) || g.startsWith(n.split(' ')[0])) return 80;
    const aliases = Object.entries(DEFAULT_ALIASES).find(([k]) => n.startsWith(k))?.[1] || [];
    if (aliases.includes(g)) return 90;
    if (n.split(' ').some((w) => w === g)) return 70;
    return 0;
  };
  const best = members.map((m) => ({ m, s: score(m) })).sort((a, b) => b.s - a.s)[0];
  if (!best || best.s < 70) return null;
  await db.run('UPDATE team_members SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [normalizeWaNumber(phone), best.m.id]);
  return best.m;
}

async function roster(orgId) {
  const members = await db.all("SELECT id, name, position, role FROM team_members WHERE organization_id = ? AND status = 'active' ORDER BY name", [orgId]);
  return members.map((m) => {
    const key = Object.keys(DEFAULT_ALIASES).find((k) => norm(m.name).startsWith(k));
    return { ...m, aliases: key ? DEFAULT_ALIASES[key] : [norm(m.name).split(' ')[0]] };
  });
}

async function clientsIndex(orgId) {
  return db.all("SELECT id, nickname, company, name FROM clients WHERE organization_id = ? AND status = 'active' ORDER BY nickname, name", [orgId]);
}

// ---------------------------------------------------------------------------
// Extracción con Claude
// ---------------------------------------------------------------------------
const extractJson = (text) => {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('La IA no devolvió JSON');
  return JSON.parse(m[0]);
};

export const hasAI = () => Boolean(aiProvider());

export async function extractTasksFromTranscript({ orgId, text, senderName = '' }) {
  if (!hasAI()) return extractTasksHeuristic({ orgId, text });
  try { return await extractTasksWithAI({ orgId, text, senderName }); }
  catch (e) { console.error('[meetings] IA falló, uso heurística:', e.message); const h = await extractTasksHeuristic({ orgId, text }); h.summary = `(IA no disponible: ${e.message}) ${h.summary}`; return h; }
}

async function extractTasksWithAI({ orgId, text, senderName = '' }) {
  const [members, clients] = await Promise.all([roster(orgId), clientsIndex(orgId)]);
  const transcript = String(text || '').slice(0, 450_000);
  const today = todayColombia();

  const prompt = `Eres el asistente de operaciones de LA REAL, una agencia de marketing digital en Colombia. Vas a leer la transcripción (o el resumen) de una reunión y extraer SOLO los compromisos accionables: tareas concretas que alguien del equipo debe hacer.

FECHA DE HOY: ${today} (zona America/Bogota). Si la transcripción trae fecha de la reunión, úsala como referencia para "el viernes", "la otra semana", etc.

EQUIPO (usa member_id exacto; apodos entre paréntesis):
${members.map((m) => `- member_id ${m.id}: ${m.name}${m.position ? ` · ${m.position}` : ''} (${m.aliases.join(', ')})`).join('\n')}

CLIENTES / MARCAS (usa client_id exacto; si una tarea es interna de la agencia, client_id null):
${clients.map((c) => `- client_id ${c.id}: ${c.nickname || c.company || c.name}${c.company && c.nickname ? ` (${c.company})` : ''}`).join('\n')}

REGLAS:
1. Convención del equipo: cuando alguien dice "tarea para <persona o área>: ..." eso SIEMPRE es una tarea. Áreas: tráfico/pauta/ads → quien lleve pauta; diseño/piezas → diseño; email/flows/Klaviyo → email marketing; UGC/creadores → UGC; web/Shopify/landing → web; si no puedes resolver el área a una persona, deja assignee_member_id null y explica en "assignee_hint".
2. También extrae compromisos implícitos claros ("yo le mando las piezas el jueves", "Laura queda de revisar..."). No inventes tareas de comentarios generales, opiniones ni ideas sin dueño ni acción.
3. Una tarea = una acción concreta y verificable. Título corto en infinitivo (máx. 80 caracteres), en español. "detail": contexto útil en 1-2 frases.
4. Fecha: si la mencionan, conviértela a YYYY-MM-DD; si dicen "esta semana" usa el viernes de esa semana; si no hay fecha, null.
5. Cliente: identifícalo por la marca mencionada en esa parte de la conversación.
6. confidence: 0.0-1.0 (qué tan seguro estás de que es una tarea real con ese responsable).
7. Devuelve máximo 25 tareas, las más importantes. Nada de duplicados.
8. "quote": fragmento literal corto (máx. 140 caracteres) que respalda la tarea.

Responde ÚNICAMENTE con JSON válido con esta forma:
{
  "meeting_title": "string corto",
  "meeting_date": "YYYY-MM-DD o null",
  "summary": "2-4 frases con lo más importante de la reunión",
  "tasks": [
    { "title": "", "detail": "", "assignee_member_id": 1, "assignee_hint": "", "client_id": null, "client_hint": "", "due_date": "YYYY-MM-DD o null", "confidence": 0.9, "quote": "" }
  ]
}

${senderName ? `La transcripción la envía ${senderName}.` : ''}

TRANSCRIPCIÓN:
<<<
${transcript}
>>>`;

  const res = await callLLM(prompt, 8000);
  const out = extractJson(res.text);
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const tasks = (out.tasks || []).slice(0, 25).map((t, i) => {
    const mid = Number(t.assignee_member_id) || null;
    const cid = Number(t.client_id) || null;
    return {
      n: i + 1,
      title: String(t.title || '').slice(0, 120),
      detail: String(t.detail || '').slice(0, 600),
      assignee_member_id: memberById[mid] ? mid : null,
      assignee_name: memberById[mid]?.name || null,
      assignee_hint: t.assignee_hint || null,
      client_id: clientById[cid] ? cid : null,
      client_name: clientById[cid] ? (clientById[cid].nickname || clientById[cid].company || clientById[cid].name) : (t.client_hint || null),
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(t.due_date || '') ? t.due_date : null,
      confidence: Math.max(0, Math.min(1, Number(t.confidence) || 0)),
      quote: String(t.quote || '').slice(0, 160),
      removed: false,
    };
  });
  return { meeting_title: out.meeting_title || 'Reunión', meeting_date: out.meeting_date || null, summary: out.summary || '', tasks, model: aiProvider(), usage: res.usage };
}

/** Aplica correcciones en lenguaje natural ("2 para Valentina", "3 el lunes", "quita 1", "agrega: ...") */
export async function applyCorrections({ orgId, intake, instruction }) {
  if (!hasAI()) return applyCorrectionsHeuristic({ orgId, intake, instruction });
  try { return await applyCorrectionsWithAI({ orgId, intake, instruction }); }
  catch (e) { console.error('[meetings] IA falló en corrección:', e.message); return applyCorrectionsHeuristic({ orgId, intake, instruction }); }
}

async function applyCorrectionsWithAI({ orgId, intake, instruction }) {
  const [members, clients] = await Promise.all([roster(orgId), clientsIndex(orgId)]);
  const today = todayColombia();
  const prompt = `Tienes una lista de tareas propuestas de una reunión y una instrucción de corrección escrita por WhatsApp. Devuelve la lista corregida.

HOY: ${today}. Reunión: ${intake.meeting_date || 'sin fecha'}.
EQUIPO: ${members.map((m) => `member_id ${m.id}=${m.name} (${m.aliases.join(', ')})`).join('; ')}
CLIENTES: ${clients.map((c) => `client_id ${c.id}=${c.nickname || c.company || c.name}`).join('; ')}

TAREAS ACTUALES (JSON):
${JSON.stringify(intake.tasks.map(({ n, title, detail, assignee_member_id, client_id, due_date, removed }) => ({ n, title, detail, assignee_member_id, client_id, due_date, removed })))}

INSTRUCCIÓN: "${instruction}"

Reglas: "quita N" / "borra N" → removed true. "N para <persona>" → cambia assignee_member_id. "N <fecha>" → due_date YYYY-MM-DD. "N es de <marca>" → client_id. "agrega: <texto>" → nueva tarea al final con n siguiente. Conserva todo lo demás igual. Responde SOLO con JSON: { "tasks": [ ...misma forma... ], "note": "qué cambiaste en una frase" }`;
  const res = await callLLM(prompt, 4000);
  const out = extractJson(res.text);
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const tasks = (out.tasks || []).map((t, i) => {
    const prev = intake.tasks.find((x) => x.n === t.n) || {};
    const mid = Number(t.assignee_member_id) || null;
    const cid = Number(t.client_id) || null;
    return {
      ...prev,
      n: t.n || i + 1,
      title: String(t.title || prev.title || '').slice(0, 120),
      detail: String(t.detail ?? prev.detail ?? '').slice(0, 600),
      assignee_member_id: memberById[mid] ? mid : null,
      assignee_name: memberById[mid]?.name || null,
      client_id: clientById[cid] ? cid : null,
      client_name: clientById[cid] ? (clientById[cid].nickname || clientById[cid].company || clientById[cid].name) : prev.client_name || null,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(t.due_date || '') ? t.due_date : null,
      removed: Boolean(t.removed),
      confidence: prev.confidence ?? 0.8,
    };
  });
  return { tasks, note: out.note || '' };
}


// ---------------------------------------------------------------------------
// Extractor sin IA (respaldo gratuito): convención "tarea para <persona/área>: ..." y compromisos
// explícitos ("X queda de...", "yo le mando..."). Se usa cuando no hay ANTHROPIC_API_KEY o la API falla.
// ---------------------------------------------------------------------------
const AREA_KEYWORDS = [
  { re: /tr[aá]fico|pauta|ads|anuncios|meta ads|campa[ñn]as/i, pos: /trafficker|tr[aá]fico|pauta|growth/i, label: 'tráfico' },
  { re: /dise[ñn]o|piezas|creativos|banners/i, pos: /dise[ñn]/i, label: 'diseño' },
  { re: /email|mail|klaviyo|flows|lealtad|fidelizaci[oó]n|crm/i, pos: /lealtad|email|crm/i, label: 'email' },
  { re: /ugc|creadores|creadoras/i, pos: /ugc/i, label: 'UGC' },
  { re: /web|shopify|landing|p[aá]gina|sitio|tienda online/i, pos: /shopify|web|develop/i, label: 'web' },
  { re: /operaciones|cartera|facturaci[oó]n|cobros/i, pos: /operaciones/i, label: 'operaciones' },
  { re: /contenido|contenidos|redes|org[aá]nico/i, pos: /contenido/i, label: 'contenido' },
];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function parseTranscriptTurns(text) {
  const turns = [];
  const re = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+([^:]{2,60}?):\s*(.*)$/;
  let meetingDate = null;
  const md = text.match(/Meeting started:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (md) meetingDate = `${md[3]}-${md[2].padStart(2, '0')}-${md[1].padStart(2, '0')}`;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(re);
    if (m) turns.push({ speaker: m[4].trim(), text: m[5].trim() });
    else if (turns.length && line && !line.startsWith('#') && !line.startsWith('>')) turns[turns.length - 1].text += ` ${line}`;
  }
  return { turns, meetingDate };
}

function resolveDate(fragment, baseIso) {
  const base = new Date(`${baseIso || todayColombia()}T12:00:00`);
  const f = norm(fragment);
  const add = (d) => { const x = new Date(base); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  if (/\bhoy\b/.test(f)) return add(0);
  if (/\bmanana\b/.test(f) && !/pasado manana/.test(f)) return add(1);
  if (/pasado manana/.test(f)) return add(2);
  const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(f));
  if (wd >= 0) { let diff = (wd - base.getDay() + 7) % 7; if (diff === 0) diff = 7; if (/(otra|proxima|siguiente|entrante) semana/.test(f)) diff += 7; return add(diff); }
  if (/(otra|proxima|siguiente|entrante) semana/.test(f)) { const diff = (5 - base.getDay() + 7) % 7 + 7; return add(diff); }
  if (/esta semana|fin de semana|antes del viernes/.test(f)) { let diff = (5 - base.getDay() + 7) % 7; if (diff === 0) diff = 0; return add(diff); }
  const dm = f.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
  if (dm) { const mi = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'].indexOf(dm[2]); const y = base.getFullYear() + (mi < base.getMonth() ? 1 : 0); return `${y}-${String(mi + 1).padStart(2, '0')}-${dm[1].padStart(2, '0')}`; }
  return null;
}

function matchMember(members, fragment) {
  const f = norm(fragment);
  // 1ª pasada: nombre completo o alias (p. ej. "juan felipe", "juanfe", "mapau")
  let best = null;
  for (const m of members) {
    const full = norm(m.name);
    const hits = [full, ...m.aliases.map(norm)].filter((a) => a.length >= 3 && new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(f));
    const len = Math.max(0, ...hits.map((h) => h.length));
    if (len && (!best || len > best.len)) best = { m, len };
  }
  if (best) return best.m;
  // 2ª pasada: primer nombre, solo si es inequívoco en el equipo
  for (const m of members) {
    const first = norm(m.name).split(' ')[0];
    if (first.length <= 3 || COMPOUND_FIRST.has(first)) continue;
    if (members.filter((x) => norm(x.name).split(' ')[0] === first).length > 1) continue;
    if (new RegExp(`\\b${first}\\b`).test(f)) return m;
  }
  return null;
}
function matchArea(members, fragment) {
  for (const a of AREA_KEYWORDS) {
    if (!a.re.test(fragment)) continue;
    const cands = members.filter((m) => a.pos.test(m.position || ''));
    return { label: a.label, member: cands.length === 1 ? cands[0] : null, candidates: cands };
  }
  return null;
}
function matchClient(clients, fragment) {
  const f = norm(fragment);
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const GENERIC = new Set(['casa', 'mundo', 'personal', 'snacks', 'shop', 'tienda', 'santi', 'detalles', 'origen', 'colombia']);
  // Solo apodo (nickname) y empresa; `name` suele ser la persona de contacto. El apodo pesa más que la empresa.
  let best = null;
  for (const c of clients) {
    const sources = [[c.nickname, 2], [c.company, 1]];
    for (const [nm, weight] of sources) {
      if (!nm) continue;
      const n = norm(nm);
      const variants = new Set();
      if (n.length >= 4 && n !== 'la real') variants.add(n);
      const w = n.split(/\s+/)[0];
      if (w.length >= 5 && !GENERIC.has(w)) variants.add(w);
      for (const v of variants) {
        if (!new RegExp(`\\b${esc(v)}\\b`).test(f)) continue;
        const score = v.length * 10 + weight;
        if (!best || score > best.score) best = { c, score };
      }
    }
  }
  return best?.c || null;
}

export async function extractTasksHeuristic({ orgId, text }) {
  const [members, clients] = await Promise.all([roster(orgId), clientsIndex(orgId)]);
  const { turns, meetingDate } = parseTranscriptTurns(text);
  const titleM = text.match(/^#\s*(.+)$/m);
  const tasks = [];
  const seen = new Set();
  const push = (t) => { const k = norm(t.title).slice(0, 60); if (!k || seen.has(k)) return; seen.add(k); tasks.push(t); };
  const sentencesOf = (txt) => txt.split(/(?<=[.!?])\s+|\s+(?=entonces\b|bueno\b)/i).map((x) => x.trim()).filter(Boolean);

  turns.forEach((turn, idx) => {
    const speakerMember = matchMember(members, turn.speaker);
    const context = turns.slice(Math.max(0, idx - 3), idx + 1).map((t) => t.text).join(' ');
    for (const sent of sentencesOf(turn.text)) {
      let m;
      // "tarea para <X>: <qué>"  /  "tarea de <X>"
      if ((m = sent.match(/tarea\s+(?:para|de)\s+([a-záéíóúñ ]{2,40}?)(?:\s*[:,]\s*|\s+(?:es|que|de)\s+)(.{8,200})/i))) {
        const who = m[1]; const what = m[2];
        const member = matchMember(members, who); const area = member ? null : matchArea(members, who);
        push({ title: what.replace(/[.,;]+$/, '').slice(0, 110), detail: sent.slice(0, 400), assignee: member || area?.member || null, hint: !member && area ? `área ${area.label}${area.candidates.length > 1 ? ` (${area.candidates.map((c) => firstName(c.name)).join('/')})` : ''}` : (!member ? who.trim() : null), client: matchClient(clients, sent) || matchClient(clients, context), due: resolveDate(sent, meetingDate), quote: sent, conf: 0.85 });
        continue;
      }
      // "<X> queda de / se encarga de / va a <hacer>"
      if ((m = sent.match(/\b([A-ZÁÉÍÓÚ][a-záéíóúñ]+)\s+(?:queda(?:s)? de|se encarga de|te encargas de|va a encargarse de|le queda)\s+(.{8,200})/))) {
        const member = matchMember(members, m[1]);
        if (member) { push({ title: m[2].replace(/[.,;]+$/, '').slice(0, 110), detail: sent.slice(0, 400), assignee: member, hint: null, client: matchClient(clients, sent) || matchClient(clients, context), due: resolveDate(sent, meetingDate), quote: sent, conf: 0.7 }); continue; }
      }
      // "yo (le) mando / envío / reviso / armo / monto / agendo / cuadro / preparo ... (hoy|mañana|el <día>)"
      if (speakerMember && (m = sent.match(/\byo\s+(?:le\s+|les\s+|lo\s+|la\s+|me\s+)?(mando|env[ií]o|reviso|armo|monto|agendo|cuadro|preparo|hago|comparto|paso|subo|programo|organizo|dejo listo|dejo lista)\s+(.{6,160})/i)) && /\b(hoy|ma[ñn]ana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|esta semana|pr[oó]xima semana|otra semana)\b/i.test(sent)) {
        push({ title: `${m[1].charAt(0).toUpperCase()}${m[1].slice(1)} ${m[2]}`.replace(/[.,;]+$/, '').slice(0, 110), detail: sent.slice(0, 400), assignee: speakerMember, hint: null, client: matchClient(clients, sent) || matchClient(clients, context), due: resolveDate(sent, meetingDate), quote: sent, conf: 0.55 });
      }
    }
  });

  const out = tasks.slice(0, 25).map((t, i) => ({
    n: i + 1,
    title: t.title.charAt(0).toUpperCase() + t.title.slice(1),
    detail: t.detail,
    assignee_member_id: t.assignee?.id || null,
    assignee_name: t.assignee?.name || null,
    assignee_hint: t.hint,
    client_id: t.client?.id || null,
    client_name: t.client ? (t.client.nickname || t.client.company || t.client.name) : null,
    due_date: t.due,
    confidence: t.conf,
    quote: t.quote.slice(0, 160),
    removed: false,
  }));
  return { meeting_title: titleM ? titleM[1].trim() : 'Reunión', meeting_date: meetingDate, summary: `Extraído sin IA (${turns.length} intervenciones). Solo detecta la convención «tarea para …» y compromisos explícitos.`, tasks: out, model: 'heuristic', usage: null };
}

/** Correcciones sin IA: "quita 2", "2 para Valentina", "3 el lunes", "1 es de Dulcey", "agrega: ..." */
export async function applyCorrectionsHeuristic({ orgId, intake, instruction }) {
  const [members, clients] = await Promise.all([roster(orgId), clientsIndex(orgId)]);
  const tasks = intake.tasks.map((t) => ({ ...t }));
  const notes = [];
  for (const part of instruction.split(/[;\n]|,\s*(?=\d)/).map((x) => x.trim()).filter(Boolean)) {
    let m;
    if ((m = part.match(/^(?:quita|borra|elimina|saca)\s+(?:la\s+)?(\d+)/i))) { const t = tasks.find((x) => x.n === +m[1]); if (t) { t.removed = true; notes.push(`quité ${t.n}`); } continue; }
    if ((m = part.match(/^agrega[r]?\s*:?\s*(.{4,})/i))) { tasks.push({ n: Math.max(0, ...tasks.map((x) => x.n)) + 1, title: m[1].slice(0, 110), detail: '', assignee_member_id: null, assignee_name: null, client_id: null, client_name: null, due_date: null, confidence: 1, quote: '', removed: false }); notes.push('agregué una tarea'); continue; }
    if ((m = part.match(/^(?:la\s+)?(\d+)\s+(.+)$/))) {
      const t = tasks.find((x) => x.n === +m[1]); if (!t) continue; const rest = m[2];
      const whoM = rest.match(/\b(?:para|a)\s+([a-záéíóúñ ]{2,40})/i);
      const mem = whoM ? matchMember(members, whoM[1]) : matchMember(members, rest);
      if (mem && /\b(para|a|de)\b/i.test(rest) && !/\bes de\b/i.test(rest)) { t.assignee_member_id = mem.id; t.assignee_name = mem.name; notes.push(`${t.n} → ${firstName(mem.name)}`); }
      const cl = /\bes de\b|\bcliente\b|\bmarca\b/i.test(rest) ? matchClient(clients, rest) : null;
      if (cl) { t.client_id = cl.id; t.client_name = cl.nickname || cl.company || cl.name; notes.push(`${t.n} → ${t.client_name}`); }
      const d = resolveDate(rest, todayColombia()) || (rest.match(/\d{4}-\d{2}-\d{2}/) || [])[0];
      if (d) { t.due_date = d; notes.push(`${t.n} → ${d}`); }
    }
  }
  return { tasks, note: notes.length ? notes.join(', ') : 'No entendí la corrección. Usa: «quita 2», «2 para Valentina», «3 el lunes», «1 es de Dulcey», «agrega: …»' };
}

// ---------------------------------------------------------------------------
// Persistencia y formato
// ---------------------------------------------------------------------------
const fmtDay = (iso) => {
  if (!iso) return 'sin fecha';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
};
const firstName = (name) => {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  return COMPOUND_FIRST.has(norm(parts[0])) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
};

export function formatProposal(intake) {
  const active = intake.tasks.filter((t) => !t.removed);
  const lines = [`📋 *${intake.title || intake.meeting_title || 'Reunión'}*${intake.meeting_date ? ` · ${fmtDay(intake.meeting_date)}` : ''}`];
  if (intake.summary) lines.push(`_${intake.summary.slice(0, 300)}_`);
  lines.push('');
  if (!active.length) {
    lines.push('No encontré tareas concretas en esta transcripción.');
    return lines.join('\n');
  }
  lines.push(`Encontré *${active.length} tarea${active.length === 1 ? '' : 's'}*:`);
  for (const t of active) {
    const who = t.assignee_name ? firstName(t.assignee_name) : `❓${t.assignee_hint ? ` (${t.assignee_hint})` : ' sin responsable'}`;
    lines.push(`*${t.n}.* ${t.title} — *${who}* · ${t.client_name || 'LA REAL'} · ${fmtDay(t.due_date)}${t.confidence < 0.6 ? ' · ⚠️ dudosa' : ''}`);
  }
  lines.push('');
  lines.push('Responde *OK* para crearlas en Orbit, o corrige: «2 para Valentina», «3 el lunes», «quita 1», «agrega: enviar propuesta a Bites».');
  lines.push('Escribe *cancelar* para descartar.');
  return lines.join('\n');
}

export async function createIntake({ orgId, teamMemberId, phone, source, title, text, extraction }) {
  const r = await db.run(`
    INSERT INTO meeting_intakes (organization_id, team_member_id, phone, source, title, meeting_date, transcript, summary, tasks, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed')
  `, [orgId, teamMemberId || null, phone || null, source, title || extraction.meeting_title, extraction.meeting_date || null, String(text || '').slice(0, 500_000), extraction.summary || null, JSON.stringify(extraction.tasks)]);
  return getIntake(r.lastInsertRowid);
}

export async function getIntake(id) {
  const row = await db.get('SELECT * FROM meeting_intakes WHERE id = ?', [id]);
  if (!row) return null;
  return { ...row, tasks: safeJson(row.tasks, []), created_task_ids: safeJson(row.created_task_ids, []) };
}

export async function saveIntakeTasks(id, tasks) {
  await db.run('UPDATE meeting_intakes SET tasks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(tasks), id]);
}

export async function openIntakeForPhone(orgId, phone) {
  const row = await db.get(`
    SELECT * FROM meeting_intakes WHERE organization_id = ? AND phone = ? AND status = 'proposed'
      AND created_at > NOW() - INTERVAL '48 hours'
    ORDER BY created_at DESC LIMIT 1
  `, [orgId, normalizeWaNumber(phone)]);
  return row ? { ...row, tasks: safeJson(row.tasks, []), created_task_ids: [] } : null;
}

export async function listIntakes(orgId, { limit = 50 } = {}) {
  const rows = await db.all(`
    SELECT i.id, i.title, i.meeting_date, i.source, i.status, i.summary, i.created_at, i.confirmed_at, i.tasks, i.created_task_ids,
           tm.name AS sender_name
    FROM meeting_intakes i LEFT JOIN team_members tm ON tm.id = i.team_member_id
    WHERE i.organization_id = ? ORDER BY i.created_at DESC LIMIT ?
  `, [orgId, limit]);
  return rows.map((r) => {
    const tasks = safeJson(r.tasks, []);
    return { ...r, tasks: undefined, task_count: tasks.filter((t) => !t.removed).length, created_task_ids: safeJson(r.created_task_ids, []) };
  });
}

async function projectForClient(orgId, clientId) {
  if (!clientId) return null;
  const p = await db.get(`
    SELECT id FROM projects WHERE organization_id = ? AND client_id = ? AND status IN ('in_progress', 'planning')
    ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1
  `, [orgId, clientId]);
  return p?.id || null;
}

/** Crea las tareas en Orbit y cierra el intake */
export async function confirmIntake({ orgId, intakeId, createdBy }) {
  const intake = await getIntake(intakeId);
  if (!intake) throw new Error('Reunión no encontrada');
  if (intake.status !== 'proposed') throw new Error(`La reunión ya está ${intake.status}`);
  const active = intake.tasks.filter((t) => !t.removed);
  const created = [];
  for (const t of active) {
    const projectId = await projectForClient(orgId, t.client_id);
    const descParts = [t.detail, t.quote ? `Dicho en la reunión: "${t.quote}"` : null, `Origen: ${intake.title}${intake.meeting_date ? ` (${intake.meeting_date})` : ''}`].filter(Boolean);
    const r = await db.run(`
      INSERT INTO tasks (title, description, project_id, assigned_to, status, priority, due_date, created_by, organization_id, visible_to_client, requires_client_approval, is_private, progress)
      VALUES (?, ?, ?, ?, 'todo', 'medium', ?, ?, ?, 0, 0, 0, 0)
    `, [t.title, descParts.join('\n\n'), projectId, t.assignee_member_id, t.due_date, createdBy || intake.team_member_id || null, orgId]);
    const taskId = r.lastInsertRowid;
    if (t.assignee_member_id) {
      await db.run('INSERT INTO task_assignees (task_id, team_member_id, organization_id) VALUES (?, ?, ?) ON CONFLICT (task_id, team_member_id) DO NOTHING', [taskId, t.assignee_member_id, orgId]);
      notifyTaskAssigned(taskId, t.title, [t.assignee_member_id], createdBy || intake.team_member_id || null).catch(() => {});
    }
    created.push({ id: taskId, n: t.n, title: t.title, assignee_member_id: t.assignee_member_id, assignee_name: t.assignee_name, due_date: t.due_date, client_name: t.client_name });
  }
  await db.run("UPDATE meeting_intakes SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP, created_task_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [JSON.stringify(created.map((c) => c.id)), intakeId]);
  return { intake, created };
}

export async function cancelIntake(intakeId) {
  await db.run("UPDATE meeting_intakes SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'proposed'", [intakeId]);
  return { cancelled: true };
}

// ---------------------------------------------------------------------------
// Medios de WhatsApp (archivo .txt / .pdf de Tactiq)
// ---------------------------------------------------------------------------
async function downloadMediaText(message) {
  const url = message?.kapso?.media_url || message?.kapso?.media_data?.url || message?.document?.link;
  if (!url) return null;
  const mime = message?.document?.mime_type || message?.kapso?.media_data?.mime_type || '';
  const { apiKey } = getKapsoConfig();
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000, headers: apiKey ? { 'X-API-Key': apiKey } : {}, maxRedirects: 3 });
  const buf = Buffer.from(res.data);
  const type = String(res.headers['content-type'] || mime || '').toLowerCase();
  const name = String(message?.document?.filename || '').toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(buf);
    return parsed?.text || null;
  }
  return buf.toString('utf8');
}

// ---------------------------------------------------------------------------
// Flujo por WhatsApp
// ---------------------------------------------------------------------------
const YES_RE = /^\s*(ok|okey|okay|listo|dale|confirmo|confirmar|s[ií]|crear|crea|va|de una|hecho|✅|👍)\b/i;
const NO_RE = /^\s*(cancelar|cancela|descartar|descarta|no\b|olv[ií]dalo)/i;
const WANTS_INTAKE_RE = /transcripci[oó]n|tactiq|reuni[oó]n|minuta|resumen de la (llamada|reuni[oó]n)|meeting/i;

/**
 * Maneja un mensaje entrante. Devuelve { reply } si Orbit debe responder, o null si no aplica.
 * @param {{ orgId, phone, text, message, clientId }} ctx — clientId: si el número también es de un cliente (se ignora si hay miembro del equipo)
 */
export async function handleWhatsappMessage({ orgId, phone, text, message }) {
  const member = await findTeamMemberByPhone(orgId, phone);
  const body = String(text || '').trim();

  // Registro: "soy Santiago"
  if (!member) {
    const m = body.match(/^\s*(?:hola[,!\s]*)?soy\s+([a-záéíóúñ\s]{2,40})$/i);
    if (m) {
      const found = await registerTeamPhoneByName(orgId, m[1], phone);
      return { reply: found
        ? `✅ Listo, ${firstName(found.name)}: registré este número en tu perfil de Orbit. Ya puedes enviarme la transcripción de una reunión (texto o el archivo de Tactiq) y te propongo las tareas.`
        : 'No encontré a nadie del equipo con ese nombre. Escribe «soy» seguido de tu nombre como aparece en Orbit.' };
    }
    return null; // no es del equipo
  }

  const open = await openIntakeForPhone(orgId, phone);
  const isDoc = message?.type === 'document' || Boolean(message?.kapso?.has_media && message?.document);
  // Parece transcripción (varias líneas con marca de tiempo + hablante, o encabezado de Tactiq)
  const looksLikeTranscript = /##\s*Transcript|Meeting started:/i.test(body) || (body.match(/^(?:\d{1,2}:)?\d{1,2}:\d{2}\s+[^:\n]{2,60}:/gm) || []).length >= 3;

  // 1) Hay una propuesta abierta → confirmar / cancelar / corregir
  if (open && !isDoc && !looksLikeTranscript && body.length < 600) {
    if (YES_RE.test(body)) {
      const { created } = await confirmIntake({ orgId, intakeId: open.id, createdBy: member.id });
      const lines = [`✅ Creé *${created.length} tarea${created.length === 1 ? '' : 's'}* en Orbit:`];
      for (const c of created) lines.push(`• ${c.title} — ${firstName(c.assignee_name) || 'sin responsable'} · ${fmtDay(c.due_date)}`);
      lines.push('', 'Cada responsable recibió su notificación. Puedes verlas en Orbit → Tareas.');
      return { reply: lines.join('\n') };
    }
    if (NO_RE.test(body)) {
      await cancelIntake(open.id);
      return { reply: '🗑️ Descartado. No creé ninguna tarea.' };
    }
    const { tasks, note } = await applyCorrections({ orgId, intake: open, instruction: body });
    await saveIntakeTasks(open.id, tasks);
    const updated = { ...open, tasks };
    return { reply: `${note ? `✏️ ${note}\n\n` : ''}${formatProposal(updated)}` };
  }

  // 2) Transcripción nueva (archivo o texto largo o mención explícita)
  let transcript = null;
  if (isDoc) {
    try { transcript = await downloadMediaText(message); } catch (e) { return { reply: `No pude leer el archivo (${e.message}). Envíalo como .txt o .pdf, o pega el resumen como texto.` }; }
    if (!transcript || transcript.trim().length < 200) return { reply: 'El archivo llegó vacío o no pude extraer texto. Envíalo como .txt o .pdf de Tactiq.' };
  } else if (body.length >= 400 || (WANTS_INTAKE_RE.test(body) && body.length >= 120)) {
    transcript = body;
  } else {
    return null; // conversación normal, no hacemos nada
  }

  let extraction;
  try {
    extraction = await extractTasksFromTranscript({ orgId, text: transcript, senderName: member.name });
  } catch (e) {
    console.error('[meetings] extracción:', e.message);
    return { reply: `No pude procesar la transcripción: ${e.message}` };
  }
  if (open) await cancelIntake(open.id);
  const intake = await createIntake({ orgId, teamMemberId: member.id, phone: normalizeWaNumber(phone), source: 'whatsapp', text: transcript, extraction });
  return { reply: formatProposal(intake) };
}

const safeJson = (v, fallback) => { if (!v) return fallback; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return fallback; } };

export default { hasAI, aiProvider, extractTasksHeuristic, applyCorrectionsHeuristic, handleWhatsappMessage, extractTasksFromTranscript, applyCorrections, formatProposal, createIntake, getIntake, listIntakes, confirmIntake, cancelIntake, saveIntakeTasks, findTeamMemberByPhone, registerTeamPhoneByName };
