#!/usr/bin/env node
/**
 * Prueba de conexión: verifica que el MCP puede autenticarse y leer datos
 * de AgenciaPro ANTES de registrarlo en Claude.
 *
 * Uso:
 *   node --env-file=.env test-connection.js
 * o bien:
 *   AGENCIAPRO_EMAIL=tu@correo.com AGENCIAPRO_PIN=1234 node test-connection.js
 */
const API_URL = (
  process.env.AGENCIAPRO_API_URL ||
  "https://agenciapro-production.up.railway.app/api"
).replace(/\/+$/, "");
const EMAIL = process.env.AGENCIAPRO_EMAIL;
const PIN = process.env.AGENCIAPRO_PIN;

async function main() {
  console.log(`→ API: ${API_URL}`);

  if (!EMAIL || !PIN) {
    console.error("✗ Falta AGENCIAPRO_EMAIL y/o AGENCIAPRO_PIN.");
    process.exit(1);
  }

  // 1. Salud del backend
  const health = await fetch(`${API_URL}/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`✗ El backend no responde en ${API_URL}/health`);
    process.exit(1);
  }
  console.log("✓ Backend en línea");

  // 2. Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, pin: PIN }),
  });
  const login = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !login.token) {
    console.error(`✗ Login falló (${loginRes.status}): ${login.error || "?"}`);
    process.exit(1);
  }
  console.log(
    `✓ Login OK — ${login.user?.name || EMAIL}` +
      `${login.current_org?.name ? ` @ ${login.current_org.name}` : ""}`
  );

  // 3. Lectura del CRM
  const stagesRes = await fetch(`${API_URL}/crm/stages`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  const stages = await stagesRes.json().catch(() => []);
  if (!stagesRes.ok) {
    console.error(`✗ No se pudieron leer las etapas del CRM (${stagesRes.status})`);
    process.exit(1);
  }
  console.log(
    `✓ CRM OK — ${stages.length} etapas: ${stages.map((s) => `${s.name} (id ${s.id})`).join(", ")}`
  );

  console.log("\n✅ Todo funciona. Ya puedes registrar el MCP en Claude (ver README.md).");
}

main().catch((e) => {
  console.error("✗ Error:", e.message);
  process.exit(1);
});
