#!/usr/bin/env node
/**
 * Genera catalog.json escaneando los route files del backend de AgenciaPro.
 * El catálogo lo usa la herramienta `api_catalog` del MCP para que Claude
 * sepa qué endpoints existen y qué campos aceptan.
 *
 * Re-ejecutar cada vez que cambie la API del backend:
 *   node generate-catalog.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.join(__dirname, "..", "backend", "src", "routes");

// El mount es /api/<nombre-de-archivo> salvo estas excepciones:
const MOUNT_OVERRIDES = {
  "projectTemplates.js": "project-templates",
  "facebook-oauth.js": "oauth/facebook",
  "shopify-oauth.js": "oauth/shopify",
  "pdf-analysis.js": "pdf",
};

function domainFor(file) {
  return MOUNT_OVERRIDES[file] || file.replace(/\.js$/, "");
}

const ROUTE_RE = /router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]*)\2/gi;
const BODY_RE = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*req\.body/;

function bodyFields(segment) {
  const m = segment.match(BODY_RE);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim().split(":")[0].trim().replace(/\s+/g, ""))
    .filter((s) => s && /^[a-zA-Z_]/.test(s));
}

const domains = {};
let total = 0;

for (const file of fs.readdirSync(ROUTES_DIR).sort()) {
  if (!file.endsWith(".js")) continue;
  const src = fs.readFileSync(path.join(ROUTES_DIR, file), "utf8");
  const domain = domainFor(file);
  const base = `/${domain}`;

  const matches = [...src.matchAll(ROUTE_RE)];
  const endpoints = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const method = m[1].toUpperCase();
    let p = m[3];
    if (p === "/" || p === "") p = "";
    const fullPath = base + p;
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
    const segment = src.slice(start, end);
    const params = [...fullPath.matchAll(/:([a-zA-Z_]+)/g)].map((x) => x[1]);

    const ep = { method, path: fullPath };
    if (params.length) ep.params = params;
    if (method !== "GET" && method !== "DELETE") {
      const fields = bodyFields(segment);
      if (fields.length) ep.body = fields;
    }
    endpoints.push(ep);
    total++;
  }
  if (endpoints.length) domains[domain] = endpoints;
}

const catalog = {
  generated: new Date().toISOString().slice(0, 10),
  note:
    "Rutas relativas a la base /api (la herramienta api_request NO necesita el prefijo /api). " +
    "Los campos 'body' son best-effort, extraídos del código del backend.",
  totalEndpoints: total,
  domains,
};

fs.writeFileSync(
  path.join(__dirname, "catalog.json"),
  JSON.stringify(catalog, null, 2)
);
console.log(
  `✓ catalog.json generado: ${total} endpoints en ${Object.keys(domains).length} dominios.`
);
