#!/usr/bin/env node
/**
 * Punto de entrada — modo REMOTO (HTTP / Streamable HTTP) con OAuth 2.1.
 * Pensado para desplegarse en Railway y que el equipo lo use como conector.
 *
 * Cada usuario se autentica con SU cuenta de AgenciaPro (ver auth.js).
 * Las 24 herramientas y la lógica viven en server-core.js.
 *
 * Variables de entorno:
 *   PORT               puerto (Railway lo define solo)
 *   PUBLIC_URL         URL pública del servicio, ej: https://...up.railway.app
 *   MCP_SECRET         secreto para firmar/cifrar los tokens (OBLIGATORIO en prod)
 *   AGENCIAPRO_API_URL API de AgenciaPro (por defecto: producción)
 */
import express from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { buildMcpServer } from "./server-core.js";
import { authProvider, handleLogin } from "./auth.js";

const PORT = process.env.PORT || 3100;
// PUBLIC_URL: explícita, o el dominio que Railway asigna solo, o localhost.
const PUBLIC_URL = (
  process.env.PUBLIC_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`)
).replace(/\/+$/, "");
const issuerUrl = new URL(PUBLIC_URL);
const resourceServerUrl = new URL(`${PUBLIC_URL}/mcp`);

const app = express();
app.use(express.json({ limit: "4mb" }));

// --- Salud (sin auth) — Railway la usa para el healthcheck ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "agenciapro-mcp", transport: "streamable-http", phase: 2 });
});

// --- Login: el formulario de la página de auth.js postea aquí ---
app.post("/login", express.urlencoded({ extended: false }), handleLogin);

// --- Endpoints OAuth 2.1 (/authorize, /token, /register, metadatos) ---
app.use(
  mcpAuthRouter({
    provider: authProvider,
    issuerUrl,
    baseUrl: issuerUrl,
    resourceServerUrl,
    scopesSupported: ["agenciapro"],
    resourceName: "AgenciaPro",
  })
);

// --- Endpoint MCP, protegido: exige un access token válido ---
const bearer = requireBearerAuth({
  verifier: authProvider,
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
});

// Sesiones MCP activas: sessionId -> transport.
const transports = {};

app.post("/mcp", bearer, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let transport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId];
    };
    const server = buildMcpServer();
    await server.connect(transport);
  } else {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Falta el header Mcp-Session-Id, o la petición no es 'initialize'.",
      },
      id: null,
    });
  }

  await transport.handleRequest(req, res, req.body);
});

// GET /mcp (stream servidor→cliente) y DELETE /mcp (cerrar sesión).
const handleSession = async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    return res.status(400).send("Sesión inválida o ausente.");
  }
  await transports[sessionId].handleRequest(req, res);
};
app.get("/mcp", bearer, handleSession);
app.delete("/mcp", bearer, handleSession);

app.listen(PORT, () => {
  console.error(`[agenciapro-mcp] Servidor HTTP escuchando en :${PORT}`);
  console.error(`[agenciapro-mcp] URL pública: ${PUBLIC_URL}`);
  console.error(`[agenciapro-mcp] Salud: ${PUBLIC_URL}/health`);
});
