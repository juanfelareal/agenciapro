#!/usr/bin/env node
/**
 * Prueba del modo HTTP: se conecta al servidor remoto (o local) como lo haría
 * Claude, y lista las herramientas.
 *
 * Uso:
 *   node test-http.js                       # contra http://localhost:3100/mcp
 *   MCP_URL=https://.../mcp node test-http.js
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.MCP_URL || "http://localhost:3100/mcp";

const client = new Client({ name: "test-http", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(url));

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(`✓ Conectado a ${url}`);
  console.log(`✓ ${tools.length} herramientas disponibles:`);
  console.log("  " + tools.map((t) => t.name).join(", "));
  await client.close();
  console.log("\n✅ El modo HTTP funciona.");
} catch (err) {
  console.error(`✗ Error: ${err.message}`);
  process.exit(1);
}
