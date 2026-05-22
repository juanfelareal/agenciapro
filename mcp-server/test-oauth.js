#!/usr/bin/env node
/**
 * Prueba end-to-end del flujo OAuth del MCP remoto.
 * Simula lo que hace Claude: registra un cliente, hace login con tus
 * credenciales, obtiene un token y se conecta al MCP usándolo.
 *
 * Requiere el servidor http.js corriendo (por defecto en :3100).
 * Uso:
 *   node --env-file=.env test-oauth.js
 */
import crypto from "crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = (process.env.MCP_BASE || "http://localhost:3100").replace(/\/+$/, "");
const EMAIL = process.env.AGENCIAPRO_EMAIL;
const PIN = process.env.AGENCIAPRO_PIN;
const REDIRECT = "http://localhost:9999/callback";

async function main() {
  if (!EMAIL || !PIN) {
    console.error("✗ Falta AGENCIAPRO_EMAIL / AGENCIAPRO_PIN en el entorno.");
    process.exit(1);
  }

  // 1. Registro dinámico de cliente (lo que hace Claude al conectar).
  const regRes = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Prueba OAuth",
      redirect_uris: [REDIRECT],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!regRes.ok) throw new Error(`registro falló: ${regRes.status} ${await regRes.text()}`);
  const client = await regRes.json();
  if (!client.client_id) throw new Error("el registro no devolvió client_id");
  console.log(`✓ Cliente registrado (DCR): ${client.client_id}`);

  // 2. PKCE (S256).
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  // 3. Login — simula el POST del formulario de la página de autenticación.
  const loginRes = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    redirect: "manual",
    body: new URLSearchParams({
      email: EMAIL,
      pin: PIN,
      client_id: client.client_id,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      state: "test-state",
    }),
  });
  const loc = loginRes.headers.get("location");
  if (loginRes.status !== 302 || !loc)
    throw new Error(`login no redirigió (status ${loginRes.status})`);
  const code = new URL(loc).searchParams.get("code");
  if (!code) throw new Error("no se obtuvo 'code' en la redirección");
  console.log("✓ Login validado contra AgenciaPro — código de autorización recibido");

  // 4. Intercambio código → tokens.
  const tokRes = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: client.client_id,
      redirect_uri: REDIRECT,
    }),
  });
  if (!tokRes.ok) throw new Error(`/token falló: ${tokRes.status} ${await tokRes.text()}`);
  const tokens = await tokRes.json();
  if (!tokens.access_token) throw new Error("no se obtuvo access_token");
  console.log(`✓ Access token emitido (válido ${Math.round(tokens.expires_in / 86400)} días)`);

  // 5. Conectar al MCP con el token y ejecutar una herramienta real.
  const mcp = new Client({ name: "test-oauth", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  });
  await mcp.connect(transport);
  const { tools } = await mcp.listTools();
  console.log(`✓ Conectado al MCP autenticado — ${tools.length} herramientas`);

  const result = await mcp.callTool({ name: "list_pipeline_stages", arguments: {} });
  const text = result.content?.[0]?.text || "";
  let stages;
  try {
    stages = JSON.parse(text);
  } catch {
    stages = null;
  }
  if (!Array.isArray(stages))
    throw new Error(`list_pipeline_stages no devolvió datos: ${text.slice(0, 200)}`);
  console.log(
    `✓ Herramienta ejecutada con el token del USUARIO — ${stages.length} etapas del CRM leídas`
  );

  // 5b. Verificar el gate de doble confirmación de borrados.
  const delTest = await mcp.callTool({
    name: "api_request",
    arguments: { method: "DELETE", path: "/invoices/99999999" },
  });
  const delText = delTest.content?.[0]?.text || "";
  if (!delText.includes("requiere_confirmacion"))
    throw new Error(`el gate de borrado no se activó: ${delText.slice(0, 200)}`);
  console.log("✓ Gate de borrados: DELETE sin confirm NO borra (pide confirmación)");

  await mcp.close();

  // 6. Probar el refresh token.
  const refRes = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: client.client_id,
    }),
  });
  if (!refRes.ok) throw new Error(`refresh falló: ${refRes.status}`);
  const refreshed = await refRes.json();
  if (!refreshed.access_token) throw new Error("el refresh no devolvió access_token");
  console.log("✓ Refresh token funciona");

  console.log("\n✅ Flujo OAuth 2.1 completo verificado de punta a punta.");
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
