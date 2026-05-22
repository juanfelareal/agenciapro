# Plan — Desplegar el MCP de AgenciaPro como conector remoto

> **Objetivo:** que el MCP pase de *local* (1 usuario, tu máquina) a *remoto*
> (servidor en Railway), conectable como **conector personalizado** en Claude
> Enterprise, para que todo el equipo lo use desde navegador, Desktop o Code —
> cada quien con su propia cuenta de AgenciaPro.
>
> Creado: 2026-05-21 · Carpeta de trabajo: `agenciapro/mcp-server/`

---

## Cómo va a funcionar (arquitectura)

```
  Compañero del equipo
        │  (navegador / Desktop / Code)
        ▼
  Claude  ──OAuth 2.1──►  Servidor MCP en Railway
        │                      │  usa el token del usuario
        │                      ▼
        └──────────────►  API de AgenciaPro (Railway)
```

- El servidor MCP corre en Railway con transporte **Streamable HTTP**.
- Autenticación **OAuth 2.1** (lo que Claude exige para conectores remotos).
  El propio servidor MCP actúa como servidor de autorización.
- Al conectar, el compañero entra a una página de login y pone **su** correo y
  PIN de AgenciaPro. El servidor lo valida contra AgenciaPro y emite un token.
- Cada llamada del MCP usa el token de **ese** usuario. Así, los permisos y la
  multi-tenancy los sigue aplicando AgenciaPro: cada quien ve y hace solo lo que
  su cuenta permite. El MCP no inventa permisos nuevos.
- El servidor MCP **no necesita base de datos propia**: el token que emite
  envuelve (firmado) el token de AgenciaPro. Se mantiene simple y sin estado.

---

## Fases

### Fase 0 — Verificación previa  🟢 pequeña (sin código)
- Confirmar en la consola de admin de Claude Enterprise que se pueden agregar
  **conectores personalizados** y quién tiene acceso de admin para hacerlo.
- Confirmar acceso a Railway (el backend ya vive ahí) y poder crear un servicio.
- Definir el nombre/URL del servicio.
- **Entregable:** luz verde técnica + admin identificado.

### Fase 1 — Transporte HTTP  🟡 mediana (código)
- Agregar al servidor MCP el transporte **Streamable HTTP** (lo soporta el SDK).
- Montarlo sobre un servidor Express con endpoint de salud `/health`.
- **Mantener el modo `stdio`** para que el uso local actual siga funcionando
  (una variable de entorno elige el modo). No rompemos nada de lo que ya sirve.
- **Entregable:** el MCP responde por HTTP en local.

### Fase 2 — Autenticación OAuth por usuario  🔴 grande (código) — la parte crítica
- Implementar el flujo OAuth 2.1 que Claude exige, apoyándonos en los helpers de
  auth que ya trae el SDK de MCP (no se hace todo a mano):
  - Metadatos: `/.well-known/oauth-protected-resource` y
    `/.well-known/oauth-authorization-server`
  - `/authorize` — página de login simple (correo + PIN de AgenciaPro)
  - `/token` — intercambio de código por token, con PKCE (S256)
  - Registro dinámico de cliente (Claude lo usa al conectar)
- El login valida contra `POST /api/auth/login` de AgenciaPro.
- **Refactor clave:** hoy `index.js` usa UN token global. Hay que volverlo
  *por usuario*: cada petición MCP usa el token de quien la hizo. El código de
  las 24 herramientas NO cambia, solo de dónde sale el token.
- Tokens firmados, con expiración; nunca se escriben secretos en logs.
- **Seguridad de borrados:** gate de doble confirmación en `api_request` para
  método DELETE + mini-adición al backend (tabla `audit_log` + endpoints
  `POST`/`GET /api/audit-log`) para el historial de quién borró qué.
- **Entregable:** un usuario puede conectar el MCP autenticándose con su cuenta,
  y los borrados quedan protegidos y registrados.

### Fase 3 — Despliegue en Railway  🟡 mediana
- Crear un servicio nuevo en Railway desde el repo `agenciapro`, raíz
  `mcp-server/`.
- Variables de entorno: `AGENCIAPRO_API_URL`, `PUBLIC_URL`, un secreto para
  firmar los tokens. **Ya NO va el email/PIN** — cada usuario pone el suyo.
- Healthcheck + dominio público.
- **Entregable:** URL pública, ej. `https://agenciapro-mcp-production.up.railway.app/mcp`

### Fase 4 — Conectar en Claude Enterprise  🟢 pequeña
- El admin agrega el conector personalizado (la URL) en la consola del org.
- Prueba end-to-end con tu cuenta: conectar → login → usar una herramienta.
- Piloto con 1–2 compañeros.
- **Entregable:** conector visible para el equipo.

### Fase 5 — Rollout y documentación  🟢 pequeña
- Instructivo de 1 página para el equipo (cómo conectar, cómo entrar con su cuenta).
- Actualizar el README.
- Opcional: endurecer — rate limiting; restringir operaciones destructivas.

---

## Decisiones (confirmadas 2026-05-21)

1. **Autenticación:** ✅ OAuth 2.1 con login de AgenciaPro (correo + PIN).
2. **Ubicación del código:** ✅ mismo repo `agenciapro`, carpeta `mcp-server/`.
3. **Borrados:** ✅ todo el equipo puede borrar, con dos protecciones (ver abajo).
4. **Admin de Enterprise:** ✅ Juan Felipe tiene el acceso de admin y agregará el conector.

## Seguridad de borrados

Política: cualquier miembro puede borrar lo que ya no sirva, pero un borrado
nunca es accidental ni anónimo.

- **Doble confirmación:** los borrados (método DELETE) pasan por `api_request`,
  en dos pasos. Primer intento → el MCP busca el ítem, muestra QUÉ se va a borrar
  y exige confirmación. Segundo intento (con confirmación explícita) → ejecuta.
- **Historial de auditoría:** cada borrado se registra — quién, qué (tipo + ID +
  nombre), cuándo. Se agrega al backend de AgenciaPro una tabla `audit_log` y
  dos endpoints (`POST /api/audit-log` para registrar, `GET /api/audit-log` para
  consultar). El MCP lo llama con el token del usuario, así queda atribuido.

---

## Costo y riesgos

- **Costo:** un servicio pequeño en Railway, ~USD 5/mes. Sin costo extra de Claude
  (el conector no consume aparte; cada quien usa su propio plan/uso).
- **Riesgo principal:** la parte OAuth (Fase 2) es la más delicada. Mitigación:
  mantenemos el modo local `stdio` funcionando como respaldo durante todo el proceso.
- **Seguridad:** el servidor queda expuesto en internet y puede tocar todos los
  datos de la agencia y de los clientes. Mitigaciones: cada usuario solo puede lo
  que su cuenta de AgenciaPro permite (AgenciaPro aplica los permisos), HTTPS
  obligatorio (Railway lo da), tokens firmados, sin logs de secretos, y la
  restricción de operaciones destructivas de la decisión 3.

---

## Estado

- [x] **Fase 0 — Verificación previa** — Enterprise permite conectores personalizados (verificado 2026-05-21).
- [x] **Fase 1 — Transporte HTTP** — `server-core.js` (núcleo + 24 tools), `index.js` (stdio), `http.js` (Streamable HTTP).
- [x] **Fase 2 — Autenticación OAuth** — `auth.js` (OAuth 2.1 + PKCE + JWT con token de AgenciaPro cifrado), gate de doble confirmación de borrados en `api_request`, y en el backend la tabla `audit_log` + ruta `/api/audit-log`. Flujo verificado de punta a punta con `test-oauth.js`. PENDIENTE: desplegar el backend (git push) para que la tabla/ruta de auditoría entren en vigor — el MCP ya funciona sin ellas.
- [ ] Fase 3 — Despliegue en Railway
- [ ] Fase 4 — Conexión en Claude Enterprise
- [ ] Fase 5 — Rollout y documentación
