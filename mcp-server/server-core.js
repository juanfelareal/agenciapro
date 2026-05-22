/**
 * server-core.js — núcleo del MCP de AgenciaPro
 * -----------------------------------------------------------------------------
 * Construye el servidor MCP con las 24 herramientas. Lo usan los dos modos:
 *   - index.js  → modo LOCAL (stdio): Claude Code / Claude Desktop
 *   - http.js   → modo REMOTO (HTTP): desplegado en Railway para el equipo
 *
 * El token de AgenciaPro se resuelve POR PETICIÓN:
 *   - Si la petición viene autenticada (modo remoto, Fase 2 OAuth) → ese token.
 *   - Si no (modo local / pruebas) → credenciales del entorno (.env).
 * -----------------------------------------------------------------------------
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const API_URL = (
  process.env.AGENCIAPRO_API_URL ||
  "https://agenciapro-production.up.railway.app/api"
).replace(/\/+$/, "");

const EMAIL = process.env.AGENCIAPRO_EMAIL;
const PIN = process.env.AGENCIAPRO_PIN;
let ENV_TOKEN = process.env.AGENCIAPRO_TOKEN || null;

// Catálogo de endpoints (generado por generate-catalog.js).
let CATALOG = null;
try {
  CATALOG = JSON.parse(readFileSync(join(__dirname, "catalog.json"), "utf8"));
} catch {
  console.error(
    "[agenciapro-mcp] Aviso: catalog.json no encontrado. Ejecuta 'node generate-catalog.js'."
  );
}

/** Inicia sesión en AgenciaPro. Devuelve la respuesta completa { token, user, current_org, ... }. */
export async function login(email, pin) {
  if (!email || !pin)
    throw new Error("Faltan credenciales de AgenciaPro (correo / PIN).");
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, pin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new Error(
      `Login falló (${res.status}): ${data.error || "credenciales inválidas"}`
    );
  }
  return data;
}

/** Token de las credenciales del entorno (modo local / pruebas). */
async function getEnvToken() {
  if (!ENV_TOKEN) ENV_TOKEN = (await login(EMAIL, PIN)).token;
  return ENV_TOKEN;
}

/**
 * Resuelve el token de AgenciaPro para la petición actual.
 * En modo remoto, el token del usuario autenticado vía OAuth llega en
 * `extra.authInfo.extra.agenciaproToken` (lo pone auth.js / verifyAccessToken).
 */
async function resolveToken(extra) {
  const apToken = extra?.authInfo?.extra?.agenciaproToken;
  if (apToken) return apToken;
  return getEnvToken();
}

/** Llama a la API de AgenciaPro con un token concreto. */
async function apiCall(token, method, path, { query, body } = {}, _retry = false) {
  let url = `${API_URL}${path.startsWith("/") ? path : "/" + path}`;
  if (query) {
    const entries = Object.entries(query).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    );
    if (entries.length) url += `?${new URLSearchParams(entries).toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Si expiró el token del ENTORNO, re-login y un reintento.
  if (res.status === 401 && !_retry && token === ENV_TOKEN) {
    ENV_TOKEN = null;
    const fresh = await getEnvToken();
    return apiCall(fresh, method, path, { query, body }, true);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data && data.error ? data.error : `HTTP ${res.status}`;
    throw new Error(`${method} ${path} → ${msg}`);
  }
  return data;
}

/** Registra una herramienta: resuelve el token, captura errores, devuelve JSON. */
function tool(server, name, description, shape, handler) {
  server.tool(name, description, shape, async (args, extra) => {
    try {
      const token = await resolveToken(extra);
      const api = (method, path, opts) => apiCall(token, method, path, opts);
      const data = await handler(args || {}, api);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `❌ ${err.message}` }],
        isError: true,
      };
    }
  });
}

/** Crea una instancia nueva del servidor MCP con las 24 herramientas. */
export function buildMcpServer() {
  const server = new McpServer({ name: "agenciapro", version: "2.1.0" });

  // ===========================================================================
  // HERRAMIENTAS UNIVERSALES — dan acceso a TODA la app
  // ===========================================================================

  tool(
    server,
    "api_catalog",
    "Catálogo de TODO lo que la app AgenciaPro puede hacer (384 endpoints). " +
      "Sin argumentos: lista los dominios. Con 'domain': muestra los endpoints de " +
      "ese dominio y sus campos. Con 'search': busca endpoints por texto. Úsalo " +
      "para descubrir qué llamar antes de 'api_request'.",
    {
      domain: z
        .string()
        .optional()
        .describe(
          "Dominio a inspeccionar, ej: invoices, commissions, collections, notes, growth, reports, siigo"
        ),
      search: z
        .string()
        .optional()
        .describe("Busca endpoints cuya ruta contenga este texto"),
    },
    async (a) => {
      if (!CATALOG)
        throw new Error(
          "catalog.json no encontrado. Ejecuta: node generate-catalog.js"
        );
      if (a.search) {
        const q = a.search.toLowerCase();
        const hits = [];
        for (const [dom, eps] of Object.entries(CATALOG.domains)) {
          for (const ep of eps) {
            if (ep.path.toLowerCase().includes(q))
              hits.push({ domain: dom, ...ep });
          }
        }
        return { search: a.search, encontrados: hits.length, endpoints: hits };
      }
      if (a.domain) {
        const d = CATALOG.domains[a.domain];
        if (!d)
          return {
            error: `El dominio '${a.domain}' no existe`,
            dominios_disponibles: Object.keys(CATALOG.domains),
          };
        return { domain: a.domain, nota: CATALOG.note, endpoints: d };
      }
      return {
        nota: CATALOG.note,
        totalEndpoints: CATALOG.totalEndpoints,
        instruccion:
          "Llama de nuevo con { domain: '<nombre>' } para ver los endpoints de un dominio, " +
          "o { search: '<texto>' } para buscar.",
        dominios: Object.fromEntries(
          Object.entries(CATALOG.domains).map(([k, v]) => [k, v.length])
        ),
      };
    }
  );

  tool(
    server,
    "api_request",
    "Herramienta UNIVERSAL: ejecuta cualquier endpoint de la API de AgenciaPro. " +
      "Úsala para todo lo que no tenga una herramienta dedicada (comisiones, cartera, " +
      "notas, métricas, reportes, formularios, dashboards, Siigo, etc.). Primero usa " +
      "'api_catalog' para ver la ruta exacta y los campos. La ruta NO lleva el prefijo " +
      "/api y debe tener los :id ya reemplazados.\n" +
      "BORRADOS (method DELETE): es un proceso de DOS pasos. La primera llamada NO " +
      "borra — devuelve lo que se eliminaría para que lo confirmes con el usuario. " +
      "Solo cuando el usuario confirme explícitamente, repite la llamada añadiendo " +
      "confirm: true. Cada borrado confirmado queda en el historial de auditoría.",
    {
      method: z
        .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
        .describe("Método HTTP"),
      path: z
        .string()
        .describe(
          "Ruta sin /api y sin :id literales. Ej: /invoices, /collections/summary, /clients/3"
        ),
      query: z
        .record(z.any())
        .optional()
        .describe("Parámetros de query como objeto. Ej: {status:'paid'}"),
      body: z
        .record(z.any())
        .optional()
        .describe("Cuerpo de la petición como objeto (para POST/PUT/PATCH)"),
      confirm: z
        .boolean()
        .optional()
        .describe(
          "Solo para DELETE: ponlo en true ÚNICAMENTE después de que el usuario " +
            "haya confirmado explícitamente el borrado."
        ),
    },
    async (a, api) => {
      // Borrado, paso 1: sin confirmar → no se borra; se muestra qué se eliminaría.
      if (a.method === "DELETE" && !a.confirm) {
        let preview = null;
        try {
          preview = await api("GET", a.path);
        } catch {
          /* algunos recursos no tienen GET individual */
        }
        return {
          requiere_confirmacion: true,
          mensaje:
            "⚠️ Esto ELIMINARÁ permanentemente el registro indicado. Muéstrale al " +
            "usuario lo que se va a borrar y, SOLO si lo confirma, vuelve a llamar " +
            "api_request con los mismos parámetros y confirm: true.",
          se_eliminara: preview ?? `(sin previsualización) ${a.path}`,
        };
      }
      // Borrado, paso 2: confirmado → copiar, borrar y registrar en auditoría.
      if (a.method === "DELETE") {
        let snapshot = null;
        try {
          snapshot = await api("GET", a.path);
        } catch {
          /* sin snapshot */
        }
        const result = await api("DELETE", a.path, { query: a.query });
        try {
          await api("POST", "/audit-log", {
            body: { action: "delete", resource_path: a.path, snapshot },
          });
        } catch {
          /* el endpoint de auditoría puede no existir aún: el borrado no se bloquea */
        }
        return result;
      }
      // Resto de métodos: directo.
      return api(a.method, a.path, { query: a.query, body: a.body });
    }
  );

  // ===========================================================================
  // LEADS (deals del CRM)
  // ===========================================================================

  tool(
    server,
    "list_pipeline_stages",
    "Lista las etapas del pipeline de ventas (CRM). Útil para conocer los stage_id.",
    {},
    (_a, api) => api("GET", "/crm/stages")
  );

  tool(
    server,
    "list_leads",
    "Lista los leads (deals) del CRM. Filtra por texto, etapa o responsable.",
    {
      search: z.string().optional().describe("Texto en nombre, empresa o email"),
      stage_id: z.coerce.number().optional().describe("ID de etapa del pipeline"),
      assigned_to: z.coerce
        .number()
        .optional()
        .describe("ID del miembro del equipo responsable"),
    },
    (a, api) => api("GET", "/crm/deals", { query: a })
  );

  tool(
    server,
    "get_lead",
    "Obtiene el detalle de un lead, incluyendo sus actividades.",
    { id: z.coerce.number().describe("ID del lead") },
    (a, api) => api("GET", `/crm/deals/${a.id}`)
  );

  tool(
    server,
    "create_lead",
    "Crea un nuevo lead (deal) en el CRM. Solo 'name' es obligatorio. Úsalo después " +
      "de leer un PDF o documento de un prospecto: extrae los datos y crea el lead.",
    {
      name: z.string().describe("Nombre del lead u oportunidad (OBLIGATORIO)"),
      client_name: z.string().optional().describe("Nombre del contacto/persona"),
      email: z.string().optional().describe("Correo del contacto"),
      phone: z.string().optional().describe("Teléfono del contacto"),
      company: z.string().optional().describe("Empresa del prospecto"),
      source: z
        .string()
        .optional()
        .describe("Fuente: Instagram, referido, formulario, etc."),
      estimated_value: z.coerce
        .number()
        .optional()
        .describe("Valor estimado del negocio"),
      stage_id: z.coerce
        .number()
        .optional()
        .describe("ID de etapa; si se omite, entra en la primera"),
      notes: z.string().optional().describe("Notas o contexto del prospecto"),
      assigned_to: z.coerce
        .number()
        .optional()
        .describe("ID del responsable"),
    },
    (a, api) => api("POST", "/crm/deals", { body: a })
  );

  tool(
    server,
    "update_lead",
    "Actualiza un lead existente. Solo pasa los campos que cambian; el resto se conserva.",
    {
      id: z.coerce.number().describe("ID del lead a actualizar"),
      name: z.string().optional(),
      client_name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      source: z.string().optional(),
      estimated_value: z.coerce.number().optional(),
      notes: z.string().optional(),
      assigned_to: z.coerce.number().optional(),
    },
    async (a, api) => {
      const { id, ...changes } = a;
      const current = await api("GET", `/crm/deals/${id}`);
      // El endpoint PUT reemplaza todos los campos: fusionar con lo actual.
      const merged = {
        name: changes.name ?? current.name,
        client_name: changes.client_name ?? current.client_name,
        email: changes.email ?? current.email,
        phone: changes.phone ?? current.phone,
        company: changes.company ?? current.company,
        source: changes.source ?? current.source,
        estimated_value: changes.estimated_value ?? current.estimated_value,
        notes: changes.notes ?? current.notes,
        assigned_to: changes.assigned_to ?? current.assigned_to,
      };
      return api("PUT", `/crm/deals/${id}`, { body: merged });
    }
  );

  tool(
    server,
    "move_lead_stage",
    "Mueve un lead a otra etapa del pipeline (avanzar/retroceder en el embudo).",
    {
      id: z.coerce.number().describe("ID del lead"),
      stage_id: z.coerce.number().describe("ID de la etapa destino"),
    },
    (a, api) =>
      api("PATCH", `/crm/deals/${a.id}/stage`, { body: { stage_id: a.stage_id } })
  );

  tool(
    server,
    "convert_lead_to_client",
    "Convierte un lead ganado en cliente. Crea el cliente con los datos del lead " +
      "y lo marca como ganado. Úsalo cuando se cierra la venta.",
    { id: z.coerce.number().describe("ID del lead a convertir") },
    (a, api) => api("POST", `/crm/deals/${a.id}/convert`)
  );

  // ===========================================================================
  // CLIENTES
  // ===========================================================================

  tool(
    server,
    "list_clients",
    "Lista los clientes de la agencia.",
    {
      search: z.string().optional().describe("Texto a buscar"),
      status: z.string().optional().describe("Filtra por estado: active, inactive"),
    },
    (a, api) => api("GET", "/clients", { query: a })
  );

  tool(
    server,
    "get_client",
    "Obtiene el detalle de un cliente.",
    { id: z.coerce.number().describe("ID del cliente") },
    (a, api) => api("GET", `/clients/${a.id}`)
  );

  tool(
    server,
    "create_client",
    "Crea un cliente. 'company' (nombre de la empresa) es obligatorio.",
    {
      company: z.string().describe("Nombre de la empresa (OBLIGATORIO)"),
      name: z.string().optional().describe("Nombre del contacto principal"),
      email: z.string().optional(),
      phone: z.string().optional(),
      nit: z.string().optional().describe("NIT / identificación tributaria"),
      address: z.string().optional(),
      city: z.string().optional(),
      nickname: z.string().optional().describe("Apodo o nombre corto"),
      status: z.string().optional().describe("Por defecto: active"),
      contract_value: z.coerce.number().optional().describe("Valor del contrato"),
      notes: z.string().optional(),
    },
    (a, api) => api("POST", "/clients", { body: a })
  );

  // ===========================================================================
  // PROYECTOS
  // ===========================================================================

  tool(
    server,
    "list_projects",
    "Lista los proyectos de la agencia.",
    {
      client_id: z.coerce
        .number()
        .optional()
        .describe("Filtra proyectos de un cliente"),
    },
    (a, api) => api("GET", "/projects", { query: a })
  );

  tool(
    server,
    "create_project",
    "Crea un proyecto. 'name' es obligatorio. Se vincula a un cliente con client_id.",
    {
      name: z.string().describe("Nombre del proyecto (OBLIGATORIO)"),
      description: z.string().optional(),
      client_id: z.coerce.number().optional().describe("ID del cliente"),
      start_date: z.string().optional().describe("Inicio (YYYY-MM-DD)"),
      end_date: z.string().optional().describe("Fin (YYYY-MM-DD)"),
      stage_id: z.coerce.number().optional().describe("ID de etapa del proyecto"),
    },
    (a, api) => api("POST", "/projects", { body: a })
  );

  // ===========================================================================
  // TAREAS
  // ===========================================================================

  tool(
    server,
    "list_tasks",
    "Lista tareas. Filtra por proyecto, estado o responsable.",
    {
      project_id: z.coerce.number().optional().describe("ID del proyecto"),
      status: z.string().optional().describe("todo, in_progress, done..."),
      assigned_to: z.coerce.number().optional().describe("ID del responsable"),
    },
    (a, api) => api("GET", "/tasks", { query: a })
  );

  tool(
    server,
    "create_task",
    "Crea una tarea. 'title' es obligatorio. Usa list_team_members para el ID del " +
      "responsable y list_projects para el ID del proyecto.",
    {
      title: z.string().describe("Título de la tarea (OBLIGATORIO)"),
      description: z.string().optional(),
      project_id: z.coerce.number().optional().describe("ID del proyecto"),
      assigned_to: z.coerce.number().optional().describe("ID del responsable"),
      status: z.string().optional().describe("Por defecto: todo"),
      priority: z.string().optional().describe("Por defecto: medium. low/medium/high"),
      due_date: z.string().optional().describe("Fecha límite (YYYY-MM-DD)"),
    },
    (a, api) => api("POST", "/tasks", { body: a })
  );

  // ===========================================================================
  // FACTURAS
  // ===========================================================================

  tool(
    server,
    "list_invoices",
    "Lista las facturas. Filtra por estado o cliente. Estados: draft, approved, " +
      "invoiced (enviada/facturada), paid. Para 'facturas de este mes' filtra y revisa issue_date.",
    {
      status: z.string().optional().describe("draft, approved, invoiced, paid"),
      client_id: z.coerce.number().optional().describe("ID del cliente"),
    },
    (a, api) => api("GET", "/invoices", { query: a })
  );

  tool(
    server,
    "get_invoice",
    "Obtiene el detalle de una factura.",
    { id: z.coerce.number().describe("ID de la factura") },
    (a, api) => api("GET", `/invoices/${a.id}`)
  );

  tool(
    server,
    "create_invoice",
    "Crea una factura. Obligatorios: client_id, amount, issue_date. El número " +
      "(FAC-XXXX) se genera automáticamente.",
    {
      client_id: z.coerce.number().describe("ID del cliente (OBLIGATORIO)"),
      amount: z.coerce.number().describe("Monto de la factura (OBLIGATORIO)"),
      issue_date: z.string().describe("Fecha de emisión YYYY-MM-DD (OBLIGATORIO)"),
      project_id: z.coerce.number().optional().describe("ID del proyecto"),
      invoice_type: z.string().optional().describe("con_iva (default) o sin_iva"),
      status: z.string().optional().describe("Por defecto: draft"),
      notes: z.string().optional(),
    },
    (a, api) => api("POST", "/invoices", { body: a })
  );

  tool(
    server,
    "send_invoice",
    "Envía una factura por correo al cliente y marca su estado como 'invoiced'.",
    { id: z.coerce.number().describe("ID de la factura a enviar") },
    (a, api) => api("POST", `/invoices/${a.id}/send`)
  );

  // ===========================================================================
  // GASTOS
  // ===========================================================================

  tool(
    server,
    "list_expenses",
    "Lista los gastos. Filtra por categoría, proyecto o rango de fechas.",
    {
      category: z.string().optional().describe("Categoría del gasto"),
      project_id: z.coerce.number().optional().describe("ID del proyecto"),
      start_date: z.string().optional().describe("Desde (YYYY-MM-DD)"),
      end_date: z.string().optional().describe("Hasta (YYYY-MM-DD)"),
    },
    (a, api) => api("GET", "/expenses", { query: a })
  );

  tool(
    server,
    "create_expense",
    "Registra un gasto. Obligatorios: description, amount, expense_date.",
    {
      description: z.string().describe("Descripción del gasto (OBLIGATORIO)"),
      amount: z.coerce.number().describe("Monto (OBLIGATORIO)"),
      expense_date: z.string().describe("Fecha YYYY-MM-DD (OBLIGATORIO)"),
      category: z.string().optional(),
      project_id: z.coerce.number().optional().describe("ID del proyecto asociado"),
      payment_method: z.string().optional().describe("Método de pago"),
      notes: z.string().optional(),
    },
    (a, api) => api("POST", "/expenses", { body: a })
  );

  tool(
    server,
    "expense_summary",
    "Resumen de gastos agrupados por categoría (total y conteo). Filtra por fechas.",
    {
      start_date: z.string().optional().describe("Desde (YYYY-MM-DD)"),
      end_date: z.string().optional().describe("Hasta (YYYY-MM-DD)"),
    },
    (a, api) => api("GET", "/expenses/summary/by-category", { query: a })
  );

  // ===========================================================================
  // EQUIPO
  // ===========================================================================

  tool(
    server,
    "list_team_members",
    "Lista los miembros del equipo. Útil para resolver nombres a IDs antes de " +
      "asignar leads o tareas.",
    {},
    (_a, api) => api("GET", "/team")
  );

  return server;
}
