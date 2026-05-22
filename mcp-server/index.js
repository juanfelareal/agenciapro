#!/usr/bin/env node
/**
 * Punto de entrada — modo LOCAL (stdio).
 * Para usar el MCP en Claude Code y Claude Desktop en tu propia máquina.
 * Las herramientas y la lógica viven en server-core.js.
 *
 * El modo REMOTO (servidor HTTP para el equipo) está en http.js.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./server-core.js";

const server = buildMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[agenciapro-mcp] Servidor MCP (stdio / local) listo.");
