# AgenciaPro MCP

Servidor MCP que conecta **AgenciaPro** (tu CRM + gestor de proyectos) con **Claude**
(Claude Code y Claude Desktop).

No modifica la app: solo consume la API REST que el backend ya expone. Así puedes
pedirle a Claude cosas como:

> "Lee este PDF del prospecto y créalo como lead en AgenciaPro"
> "Lista los leads que están en la etapa de propuesta"
> "Convierte el lead 12 en cliente y créale un proyecto de onboarding"

---

## 1. Instalar

```bash
cd /Users/realjuanfe/agenciapro/mcp-server
npm install
```

## 2. Probar la conexión (antes de conectarlo a Claude)

```bash
cp .env.example .env        # luego edita .env con tu correo y PIN
node --env-file=.env test-connection.js
```

Si todo está bien verás `✅ Todo funciona`. Si falla, el mensaje te dice por qué
(credenciales, backend caído, etc.).

## 3. Conectarlo a Claude Code

Un solo comando (reemplaza el correo y el PIN por los tuyos):

```bash
claude mcp add agenciapro --scope user \
  -e AGENCIAPRO_EMAIL=tu-correo@larealmarketing.com \
  -e AGENCIAPRO_PIN=tu-pin \
  -- node /Users/realjuanfe/agenciapro/mcp-server/index.js
```

`--scope user` hace que esté disponible en todos tus proyectos. Verifica con
`claude mcp list`.

## 4. Conectarlo a Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json` y agrega
el bloque `agenciapro` dentro de `mcpServers`:

```json
{
  "mcpServers": {
    "agenciapro": {
      "command": "node",
      "args": ["/Users/realjuanfe/agenciapro/mcp-server/index.js"],
      "env": {
        "AGENCIAPRO_EMAIL": "tu-correo@larealmarketing.com",
        "AGENCIAPRO_PIN": "tu-pin"
      }
    }
  }
}
```

Reinicia Claude Desktop. El servidor aparece como 🔌 en la conversación.

---

## Herramientas disponibles (24)

**Universales — dan acceso a TODA la app (384 endpoints):**

| Herramienta | Qué hace |
|---|---|
| `api_catalog` | Lista todos los endpoints de la app; filtra por dominio o busca por texto |
| `api_request` | Ejecuta cualquier endpoint (comisiones, cartera, notas, métricas, reportes, Siigo, etc.) |

**Dedicadas — para lo de uso diario:**

| Herramienta | Qué hace |
|---|---|
| `list_pipeline_stages` | Lista las etapas del pipeline de ventas |
| `list_leads` / `get_lead` / `create_lead` / `update_lead` | Gestión de leads (deals) |
| `move_lead_stage` / `convert_lead_to_client` | Mover lead de etapa / convertir a cliente |
| `list_clients` / `get_client` / `create_client` | Gestión de clientes |
| `list_projects` / `create_project` | Gestión de proyectos |
| `list_tasks` / `create_task` | Gestión de tareas |
| `list_invoices` / `get_invoice` / `create_invoice` / `send_invoice` | Gestión de facturas |
| `list_expenses` / `create_expense` / `expense_summary` | Gestión de gastos |
| `list_team_members` | Lista el equipo (para asignar responsables) |

> **Todo lo demás** (comisiones, cartera, notas, formularios, dashboards, métricas
> de clientes, reportes, Siigo…) se hace con `api_catalog` + `api_request`. Nada
> queda fuera de alcance.

### Mantener el catálogo actualizado

Si cambias la API del backend, regenera el catálogo de endpoints:

```bash
npm run catalog   # equivale a: node generate-catalog.js
```

## Configuración

| Variable | Descripción |
|---|---|
| `AGENCIAPRO_API_URL` | URL de la API. Por defecto: producción en Railway. |
| `AGENCIAPRO_EMAIL` | Tu correo de AgenciaPro. |
| `AGENCIAPRO_PIN` | Tu PIN de AgenciaPro. |
| `AGENCIAPRO_TOKEN` | (Opcional) token ya emitido; si lo defines, se omite el login. |

El token de sesión dura 10 años y se renueva solo. Si en algún momento se
revoca, el servidor vuelve a iniciar sesión automáticamente con tu correo y PIN.

## Usar el backend local en vez de producción

Cambia `AGENCIAPRO_API_URL` a `http://localhost:3000/api` y arranca el backend
(`cd ../backend && npm start`).
