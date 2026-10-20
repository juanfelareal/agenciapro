# Auditoría de aislamiento multi-tenant (Orbit / AgenciaPro)

**Fecha:** 2026-10-20 · **Rama:** `redesign-papel-tinta` · **Alcance:** todo el backend (`backend/src/routes/**`, `backend/src/services/*`, `backend/src/utils/*`, middlewares, `database.js`, migración 001) y el registro de organizaciones.

## 1. Objetivo

Orbit se vende a otras agencias como SaaS multi-tenant: **ninguna organización puede ver ni tocar datos de otra**. Esta auditoría recorre todas las consultas SQL del backend, corrige cada hueco y deja una prueba automatizada (`backend/scripts/test-tenant-isolation.mjs`) que lo demuestra.

## 2. Reglas aplicadas

- Toda lectura/escritura sobre una tabla con `organization_id` filtra por `organization_id = req.orgId` (o por la org del cliente autenticado en el portal, o por la org de la fila del token en rutas públicas).
- Si el recurso cuelga de un padre (tarea → proyecto, subtarea → tarea, sección → formulario, etc.) se verifica el padre en la org (JOIN o `assert*InOrg`) **antes** de leer/escribir.
- Ids que llegan en el body (`client_id`, `project_id`, `task_id`, `assigned_to`, `member_ids`, `stage_id`, `tag_id`, `category_id`, `folder_id`, `template_id`, `creator_id`, ...) se validan contra la org; si son ajenos → **404** (nunca 403: no revelar existencia). Donde el valor es opcional (p. ej. `created_by`) se reemplaza por el miembro autenticado o `null`.
- `UPDATE/DELETE ... WHERE id = ?` siempre lleva `AND organization_id = ?` y responde 404 si `changes === 0`.
- Todo `INSERT` en una tabla con `organization_id` lo escribe explícitamente. Motivo: el backfill de arranque (`database.js`) asignaba las filas con `organization_id NULL` a la **primera organización**, convirtiendo cualquier INSERT descuidado en una fuga hacia la org 1. Ese backfill ahora hereda la org del padre y solo cae a "primera org" cuando hay una única organización (instalación legacy).
- Contratos de respuesta sin cambios (mismas keys); solo cambian códigos 403/400/200 → 404 en accesos cruzados, documentados abajo.

## 3. Helper nuevo: `backend/src/utils/tenant.js`

| Función | Uso |
|---|---|
| `assertClientInOrg(db, clientId, orgId, columns='*')` | Devuelve la fila de `clients` o lanza `TenantError` (status 404) |
| `assertProjectInOrg`, `assertTaskInOrg`, `assertInvoiceInOrg`, `assertNoteInOrg`, `assertFormInOrg` | Idem para proyectos, tareas, facturas, notas y formularios |
| `assertRowInOrg(db, table, id, orgId, { columns, idColumn, label })` | Genérica para cualquier tabla con `organization_id` |
| `assertAllRowsInOrg(db, table, ids, orgId)` | Verifica listas de ids (miembros, etiquetas, valores) |
| `findRowInOrg(...)` | Igual que `assertRowInOrg` pero devuelve `null` (padres opcionales) |
| `sendTenantError(res, error)` | Responde 404 si es `TenantError`, 500 si no |
| `requireOrg` | Middleware que exige `req.orgId` |

## 4. Cambios de esquema / arranque (`backend/src/config/database.js`, `migrations/001-multi-tenancy.js`)

| Cambio | Motivo |
|---|---|
| `organizations.trial_ends_at TIMESTAMP` (`ADD COLUMN IF NOT EXISTS`) | Plan de prueba; `/register` la llena con `now + 14 días` |
| Backfill de `organization_id`: primero **hereda del padre** (`childOrgBackfills`: projects←clients, tasks←projects, subtasks/task_comments/task_files/task_assignees/board_columns/project_team←tasks/projects, client_*←clients, growth_*←clients, note_versions←notes, ad_tag_values←ad_tag_categories, ...) y el fallback "todo a la primera org" **solo si existe una sola organización**; con varias orgs los huérfanos se reportan en el log y no se asignan | Antes cualquier fila con org NULL se regalaba a la org 1 en cada arranque |
| Migración 001, paso 4b/4c: `organization_id = COALESCE(organization_id, LA REAL)` y el backfill masivo solo con una organización | Idem: la migración corre en cada arranque |
| Índices UNIQUE por organización (idempotentes, replican el paso 6 de la migración 001): `tags(name, org)`, `note_categories(name, org)`, `sop_categories(name, org)`, `invoices(invoice_number, org)`, `team_members(user_id, org)`; se elimina el UNIQUE global previo | En una base nueva la migración no corría y dos orgs no podían tener `FAC-0001` |
| Seeds de la org 1 (etapas UGC, industrias, paquetes, plantillas de dashboard, NDA) condicionados a `EXISTS (organizations WHERE id = 1)` | Permiten inicializar una base vacía; nunca se copian a orgs nuevas |
| `tasks.linked_form_id` se agrega solo si `forms` ya existe; `ugc_project_settlements` y `ugc_creator_notes` se crean después de `ugc_projects` | `initializeDatabase()` fallaba en una base totalmente vacía (orden de FKs) |
| Pool de la migración 001 usa SSL solo en producción | Igual criterio que `database.js`; permite correr la migración en local |

No fue necesario añadir `organization_id` a ninguna tabla: las que no lo tienen (`task_dependencies`, `task_tags`, `board_column_values`, `project_template_tasks`, `note_links`, `form_sections`, `form_fields`, `form_responses`, `sop_revisions`, `chat_members`, `invoice_status_history`, `payroll_employees`, `bank_transactions`, `client_group_members`, `org_news_reads`, `orbit_feedback_votes`, `reference_ad_clients`, `reference_ad_groups`, `ugc_creator_list_members`, `ugc_project_creators`) se verifican siempre vía su padre.

## 5. Registro de organización (`routes/auth.js`, `middleware/teamAuth.js`)

| Archivo | Ruta/función | Hallazgo | Corrección |
|---|---|---|---|
| routes/auth.js | POST /register | Org nueva nacía con `plan='free'` y sin fecha de prueba | `plan='trial'`, `trial_ends_at = now + 14 días`; la respuesta incluye `plan` y `trial_ends_at` en `current_org` |
| routes/auth.js | POST /register | Verificado: no hay seeds que copien datos de la org 1 (los seeds de UGC/NDA/dashboard son solo para `id = 1`; las etapas de proyecto por defecto se crean por org como estructura, no como datos). La prueba comprueba que la org B arranca vacía | — |
| routes/auth.js | POST /invite | `role` del body sin validar; relectura del miembro sin org y con `pin_hash` | Rol limitado a `admin/manager/member`; relectura con `organization_id`; se elimina `pin_hash` de la respuesta; exige `req.orgId` |
| routes/auth.js | login, select-org, logout, me, validate, reset-pin, bootstrap, restore-all-sessions | Sin hallazgos: `select-org` verifica membresía activa; `reset-pin` solo toca el usuario propio; `restore-all-sessions` gated por secreto | — |
| middleware/teamAuth.js | sesión legacy (`team_session_tokens`) | Un miembro sin `organization_id` entraba con `req.orgId = null`: las consultas no filtraban nada y los INSERT quedaban con org NULL | Sesión legacy sin organización → 401 |

## 6. Tareas, proyectos, tableros, etiquetas, plantillas de proyecto, automatizaciones

Archivos revisados (16): routes/tasks.js, subtasks.js, task-comments.js, task-files.js, task-dependencies.js, task-history.js, task-views.js, board-columns.js, tags.js, project-stages.js, projects.js, projectTemplates.js, automations.js, services/automationEngine.js, services/meetingTasks.js, utils/activityLog.js. Rutas HTTP revisadas: 71. Funciones de servicio revisadas: 12.

| Archivo | Ruta/función | Hallazgo | Corrección |
|---|---|---|---|
| routes/tasks.js | POST / | `linked_form_id` del body no se verificaba: se podía enlazar un formulario de otra org y crear `form_assignments` con él | `assertFormInOrg` (404) |
| routes/tasks.js | POST / | `created_by` del body sin verificar (miembro de otra org como creador) | Si no es miembro de la org → se usa `req.teamMember.id` |
| routes/tasks.js | POST / y PUT /:id | Proyecto/miembros ajenos respondían 403 (revela existencia) | 404 vía `assertProjectInOrg` / `assertAllRowsInOrg(team_members)` |
| routes/tasks.js | PUT /:id | `linked_form_id` sin verificar al cambiarlo | `assertFormInOrg` (404) |
| routes/tasks.js | PUT /:id, GET /assigned-alerts | Lookups de nombres (`team_members`, `projects`) por lista de ids sin org | `AND organization_id = ?` |
| routes/tasks.js | GET /, GET /:id, DELETE /:id, bulk-visibility, assigned-alerts | Sin hallazgos: filtran por `t.organization_id` | — |
| routes/subtasks.js | (todas) | Sin hallazgos: verifica tarea en org y JOIN tasks en subrecursos | — |
| routes/task-comments.js | POST / | `user_id` (autor) del body sin verificar: se podía firmar como miembro de otra org | Verifica `team_members.organization_id` → 404 |
| routes/task-comments.js | POST /, PUT /:id | Lectura/UPDATE post-verificación por id sin org | `AND organization_id = ?` |
| routes/task-files.js | POST /upload, POST / | `uploaded_by` del body sin verificar | Si no es miembro de la org → `req.teamMember.id` |
| routes/task-files.js | POST, PATCH | Lecturas post-escritura por id sin org | `AND tf.organization_id = ?` |
| routes/task-dependencies.js | (todas) | Verificaba la tarea vía `JOIN projects` (tareas sin proyecto quedaban inaccesibles); los listados mostraban la tarea contraparte sin exigir org | `t.organization_id` directo; `AND t.organization_id = ?` en la contraparte; en /project/:id/chain ambas tareas en org |
| routes/task-history.js | GET /:taskId | Sin hallazgos: verifica tarea en org | — |
| routes/task-views.js | (todas) | Sin hallazgos: filtra por team_member + org | — |
| routes/board-columns.js | POST / | INSERT sin `organization_id` → el backfill de arranque se la asignaba a la org 1 | INSERT con `organization_id = req.orgId` |
| routes/board-columns.js | PUT /:id | UPDATE por id sin org | `AND organization_id = ?` |
| routes/board-columns.js | GET /values/task/:taskId, POST /values | Tarea verificada vía `JOIN projects` (tareas sin proyecto); valores listados sin exigir columna de la org | `t.organization_id`; JOIN projects con org en el listado de valores |
| routes/tags.js | GET/POST/DELETE /task/:taskId(/tag/:tagId), PUT /task/:taskId | **La tarea no se verificaba**: se podían agregar/quitar etiquetas (y vaciar todas con PUT) en tareas de otra org | `assertTaskInOrg` → 404 en las 4 rutas; tag ajeno → 404 |
| routes/tags.js | POST /task/:taskId/tag/:tagId | `INSERT OR IGNORE` (SQLite) fallaba en Postgres | `ON CONFLICT (task_id, tag_id) DO NOTHING` |
| routes/project-stages.js | (todas) | Sin hallazgos | — |
| routes/projects.js | DELETE /:id?move_tasks_to= | **Movía tareas de un proyecto ajeno** (`UPDATE tasks SET project_id WHERE project_id = ?`) antes de verificar el proyecto a borrar | Verifica proyecto en org primero; UPDATE con `AND organization_id = ?` |
| routes/projects.js | GET /:id | Equipo del proyecto sin filtrar miembros por org | `AND tm.organization_id = ?` |
| routes/projects.js | POST /, PUT /:id, POST /:id/team | Cliente/etapa/miembro ajeno respondía 400 con "not found in your organization" | 404 neutro; lecturas post-escritura con org |
| routes/projectTemplates.js | POST /, POST /:id/tasks, PUT /:id/tasks/:taskId | `default_assignee_id` sin verificar: se guardaba un miembro de otra org y GET /:id exponía su nombre | `resolveAssignee` (solo miembros de la org, si no null); LEFT JOIN team_members con org |
| routes/projectTemplates.js | PUT/DELETE /:id/tasks/:taskId | UPDATE/DELETE por id sin `template_id` | `AND template_id = ?` |
| routes/automations.js | POST /, PUT /:id | `action_params.user_id`/`tag_id` y `trigger_conditions.assigned_to` sin verificar: una automatización podía asignar tareas (y notificar) a un miembro de otra org o etiquetar con tags ajenos | `validateAutomationRefs` → 404; PUT verifica además que la automatización sea de la org |
| services/automationEngine.js | executeAction | Ejecutaba acciones aunque automatización y tarea fueran de orgs distintas; `assign_user`/`add_tag`/`send_notification` usaban ids sin verificar | Guard de org al inicio; verifica miembro/tag en la org de la tarea (si no, omite); UPDATE tasks con org; `add_tag` idempotente con ON CONFLICT |
| services/automationEngine.js | checkDueDateAutomations | Tareas vía `JOIN projects` (tareas sin proyecto se saltaban) | `t.organization_id` directo |
| services/meetingTasks.js | getIntake, saveIntakeTasks, cancelIntake | Accedían por id sin org (las rutas de whatsapp.js comparaban `organization_id` a mano) | Nuevo parámetro opcional `orgId`; si se pasa filtra por org |
| services/meetingTasks.js | confirmIntake | Confiaba en `assignee_member_id`/`client_id` guardados en el JSON del intake | Verifica intake en org (404 lógico) y limpia responsables/clientes que no sean de la org antes de crear tareas; UPDATE final con org |
| services/meetingTasks.js | resto | Sin hallazgos: miembros/clientes se consultan por `organization_id` | — |
| utils/activityLog.js | logActivity / logTaskActivity | Sin hallazgos: `organization_id` tomado de `req.orgId` | — |

### Cambios de esquema requeridos
Ninguno. `task_dependencies`, `task_tags`, `board_column_values` y `project_template_tasks` se verifican vía padre (tasks/board_columns/project_templates tienen `organization_id`).

### Notas para otros grupos
- `meetingTasks.getIntake(id, orgId?)`, `saveIntakeTasks(id, tasks, orgId?)`, `cancelIntake(intakeId, orgId?)`: parámetro opcional nuevo. `routes/whatsapp.js` (grupo E) puede pasar `req.orgId` y quitar la comparación manual `it.organization_id !== req.orgId`; sin cambios sigue funcionando.
- `routes/task-comments.js` y `routes/tasks.js` llaman a `notifyNewComment/notifyMentions/notifyTaskAssigned/notifyTaskUpdated/notifyTaskCompleted` (utils/notificationHelper.js, grupo C) sin pasar orgId: conviene que el helper derive la org desde la tarea (`tasks.organization_id`) al insertar en `notifications`.
- `tasks.js` auto-crea `form_assignments` (ahora con el formulario verificado en la org). `forms.js`/`form-share.js` (grupo B) deberían seguir filtrando asignaciones por `organization_id`.
- Bugs funcionales fuera de alcance (no tocados): en `tasks.js` la ruta `PUT /bulk-visibility` está declarada después de `PUT /:id` y nunca se alcanza; igual `PUT /:id/tasks/reorder` en `projectTemplates.js` (la captura `PUT /:id/tasks/:taskId`) y `PUT /reorder` en `task-views.js`.
- `task-files` guarda archivos en `uploads/task-files/<uuid>.<ext>` servidos públicamente por `/uploads`: el nombre es UUID (no adivinable), sin org en la ruta. Grupo F/blobStorage decide si hace falta más.

## 7. Notas, SOPs, plantillas de documentos, formularios, briefs, chat, colaboración y portal (notas/forms/documentos)

| Archivo | Ruta/función | Hallazgo | Corrección |
|---|---|---|---|
| routes/notes.js | POST / | `category_id` y `folder_id` del body sin verificar org; `links[]` (client_id/project_id/team_member_id) sin verificar | `resolveNoteParent` (findRowInOrg note_categories/note_folders) + `assertLinksInOrg`; 404 vía `sendTenantError` |
| routes/notes.js | PUT /:id | Mismo hueco: categoría, carpeta y links del body sin verificar org | Igual que POST /; se reemplazan links solo tras validar |
| routes/notes.js | POST /:id/links | Entidades ajenas respondían 400 (revelaban existencia) | Ahora 404 |
| routes/notes.js | POST /:id/versions/:versionId/restore | `SELECT notes WHERE id = ?` sin org (dos veces) | `AND organization_id = ?` |
| routes/notes.js | (resto: GET, pin, color, visibility, links, versions, search, delete) | Sin hallazgos: ya filtra por org | — |
| routes/note-categories.js | PUT /:id | Devolvía `undefined` (200) si la categoría era de otra org | 404 si no existe en la org |
| routes/note-categories.js | (resto) | Sin hallazgos | — |
| routes/note-folders.js | PUT /reorder | `UPDATE note_folders ... WHERE id = ?` SIN org (podía mover/reordenar carpetas de otra org) y `parent_id` sin verificar | `AND organization_id = ?` + `parent_id` validado con `parentFolderInOrg` (404) |
| routes/note-folders.js | POST / | `parent_id` del body sin verificar org | `parentFolderInOrg`, 404 |
| routes/note-folders.js | PUT /:id | `parent_id` del body sin verificar org; 200 con `undefined` si carpeta ajena | `parentFolderInOrg`, 404 ambos casos |
| routes/note-folders.js | PUT /reorder (duplicada al final) | Código muerto (segunda definición inalcanzable, con `db.transaction` sync incorrecto) | Eliminada |
| routes/note-share.js | PUT /:id/edits/:editId | Tras UPDATE con org, releía `note_client_edits` y `notes` por id SIN org: una edición ajena podía escribir `last_edited_by_client` en nota propia; sin 404 | 404 si `changes === 0`; relecturas con `note_id` + `organization_id` |
| routes/note-share.js | POST /public/:token/comments | `parent_id` del body sin verificar (podía colgar un comentario de otra nota/org) | Verificar `parent_id` ∈ misma nota y org del token, 404 |
| routes/note-share.js | DELETE /:id/share/:tokenId | Revocar token ajeno respondía 200 | 404 si `changes === 0` |
| routes/note-share.js | generateShareCode | Token de 8 símbolos (≈40 bits) | 12 símbolos (≈60 bits), mismo alfabeto legible |
| routes/note-share.js | (resto público: GET /public/:token, comments, edits) | Sin hallazgos: todo cuelga de la fila del token (UNIQUE) y usa `shareToken.organization_id` | — |
| routes/sops.js | POST / | `category_id` y `created_by` del body sin verificar org | `sopCategoryInOrg` (404) + `memberInOrgOrSelf` (si no es de la org → req.teamMember.id) |
| routes/sops.js | PUT /:id | `category_id` del body sin verificar; `changed_by` del body sin verificar (sop_revisions) | Igual que POST |
| routes/sops.js | (resto) | Sin hallazgos | — |
| routes/document-templates.js | DELETE /:id | COUNT de `document_signatures` por template_id sin org (400 revelaba firmas de otra org) | `AND organization_id = ?` |
| routes/document-templates.js | DELETE /signatures/:signatureId | DELETE por id sin org (ya verificado antes, defensa en profundidad) | `AND organization_id = ?` |
| routes/document-templates.js | (resto) | Sin hallazgos: assign verifica plantilla y cliente en la org | — |
| routes/forms.js | POST /:id/assign | `client_id` del body sin verificar: se podía asignar un formulario a un cliente de OTRA org (y ese cliente lo vería en su portal) | `findRowInOrg(clients)` → 404; chequeo de duplicado con org |
| routes/forms.js | generateShareCode | Token público de 8 símbolos (≈40 bits) | 12 símbolos (≈60 bits) |
| routes/forms.js | (resto: PUT /:id secciones/campos, duplicate, responses, share) | Sin hallazgos: ids de sección/campo se aceptan solo si están en los conjuntos actuales del formulario propio | — |
| routes/form-share.js | (todas) | Sin hallazgos: todo cuelga de `forms.share_token` / `form_assignments.share_token` (UNIQUE) y usa `form.organization_id` | — |
| routes/structuredBriefs.js | POST / | `client_id` sin verificar org; `sections[].responsible_id` sin verificar (exponía nombre de miembro ajeno vía JOIN) | `findRowInOrg(clients)` → 404; `responsibleInOrg` (null si ajeno) |
| routes/structuredBriefs.js | PUT /:id | `client_id` sin verificar org | 404 si ajeno |
| routes/structuredBriefs.js | POST /:id/sections, PUT /:id/sections/:sectionId | `responsible_id` sin verificar org | `responsibleInOrg` |
| routes/structuredBriefs.js | (resto: tasks, delete, generate-project, areas) | Sin hallazgos: jerarquía brief→sección→tarea verificada con org | — |
| routes/briefs.js | POST /, PUT /:id | `client_id` sin verificar org | `findRowInOrg(clients)` → 404 |
| routes/chat.js | verifyMembership | Solo comprobaba membresía, no que la conversación fuese de la org activa | JOIN `chat_conversations.organization_id`; helper `requireMembership`: 404 si la conversación no es de la org, 403 si no es miembro |
| routes/chat.js | POST /conversations | `member_ids` sin verificar: se podían meter miembros de otra org | `assertAllRowsInOrg(team_members)` → 404 |
| routes/chat.js | POST /conversations, POST /:id/messages, POST /:id/upload | INSERT en `chat_messages` sin `organization_id` (el backfill de arranque los asignaba a la org 1) | `organization_id = req.orgId` en los 3 INSERT |
| routes/chat.js | PUT /conversations/:id/read | UPDATE `chat_members` sin org | Subconsulta `conversation_id IN (... organization_id = ?)` |
| routes/chat.js | (resto: search/entities, entity-preview, unread-count) | Sin hallazgos | — |
| services/chatService.js | socket `authenticate` | **Confiaba en `teamMemberId` enviado por el cliente sin validar el token**: cualquiera podía suplantar a cualquier miembro, unirse a sus conversaciones y leer/enviar | Nuevo `resolveSocketSession(token)` (user_session_tokens → team_session_tokens, con expiración); el id viene de la sesión; si el cliente manda otro id → error. Guarda `socket.data.orgId` |
| services/chatService.js | socket `authenticate` | Auto-join a conversaciones por `team_member_id` sin org | JOIN con `chat_conversations.organization_id` |
| services/chatService.js | socket `send-message` | No verificaba membresía ni org; INSERT sin `organization_id` | `socketCanAccessConversation` (miembro + org) y `organization_id` explícito |
| services/chatService.js | socket `typing`/`stop-typing`/`mark-read` | Emitían/actualizaban sobre cualquier conversationId | Solo salas en las que el socket está / membresía verificada |
| services/collaborationService.js | socket `join-note` | **Sin autenticación alguna**: cualquiera con el id de nota leía y escribía el documento Yjs de cualquier org | Exige token (payload `token`, `handshake.auth.token` o `?token=`), resuelve sesión y verifica `notes.organization_id`; notas privadas solo para su creador |
| routes/portal/notes.js | POST /:noteId/comments | `parent_id` del body sin verificar | Debe pertenecer a la misma nota, 404 |
| routes/portal/notes.js | (resto) | Sin hallazgos: todo cuelga de `note_links.client_id = req.client.id AND visible_in_portal` | — |
| routes/portal/forms.js | POST /:assignmentId/submit | Notificación insertada con `organization_id = null` (no se seleccionaba `fa.organization_id`) → backfill la asignaba a la org 1 | SELECT incluye `fa.organization_id` |
| routes/portal/forms.js | (resto) | Sin hallazgos: todo por `fa.client_id = req.client.id` | — |
| routes/portal/structured-briefs.js | (todas) | Sin hallazgos de aislamiento (filtra por `client_id` + `visible_to_client`). Nota: consulta la tabla `structured_briefs`, que no existe en database.js (los briefs estructurados viven en `briefs.brief_type='structured'`) — ruta rota, fuera del alcance de aislamiento | — |
| routes/portal/documents.js | (todas) | El router NO aplicaba `clientAuthMiddleware` (ninguna ruta lo tenía): `req.client` undefined → 500; sin sesión de cliente real | `router.use(clientAuthMiddleware)` al inicio |

### Cambios de esquema requeridos
Ninguno. Las tablas sin `organization_id` (note_links, form_sections, form_fields, form_responses, sop_revisions, chat_members) se verifican vía su padre.

### Tokens públicos
- `note_share_tokens.token`: `UNIQUE`, generado con `crypto.randomInt` sobre alfabeto de 32 símbolos; subido de 8 a 12 símbolos (~60 bits). Las rutas `/api/note-share/public/:token/*` solo leen/escriben la nota y org de la fila del token. Los tokens existentes de 8 símbolos siguen funcionando.
- `forms.share_token`: `UNIQUE` (índice), mismo generador, subido a 12 símbolos. `/api/form-share/public/:token/*` cuelga de la fila del formulario.
- `form_assignments.share_token`: `UNIQUE`, `crypto.randomBytes(16).hex` (128 bits). `/api/form-share/assignment/:token/*` cuelga de la asignación.
- Ninguno es enumerable en la práctica; no hay listados públicos de tokens.

### Notas para otros grupos
- **FRONTEND requerido** (fuera de mi alcance): `frontend/src/hooks/useCollaboration.js` debe enviar el token de sesión al unirse: `socket.emit('join-note', { noteId, user, token: localStorage.getItem('token') })` (o pasarlo en `io(url, { auth: { token } })`). Sin esto, la edición colaborativa de notas queda bloqueada con `error: 'No autenticado'` (decisión deliberada: antes era acceso sin autenticación a cualquier nota). `useChat.js` ya envía `token`, no necesita cambios.
- `services/chatService.js` ahora exporta `resolveSocketSession(token)` → `{ teamMemberId, orgId, name } | null`; sirve para autenticar cualquier otro namespace de Socket.io (p. ej. `agents/socket.js`).
- `routes/chat.js`: `verifyMembership(conversationId, teamMemberId, orgId)` tiene ahora 3 parámetros (uso interno del archivo).
- Hallazgo funcional no corregido: `routes/portal/structured-briefs.js` consulta la tabla inexistente `structured_briefs`.

## 8. Clientes, portal del cliente, portal-admin, dashboards compartidos, búsqueda, notificaciones, noticias, feedback, equipo

| Archivo | Ruta/función | Hallazgo | Corrección |
|---|---|---|---|
| routes/clients.js | PUT /:id/visibility | `member_ids` del body se guardaban sin verificar que fueran miembros de la org (se podía "compartir" un cliente con ids de otra org) | Se filtran contra `team_members WHERE organization_id = req.orgId`; ids ajenos se descartan |
| routes/clients.js | POST / | INSERT en `client_portal_settings` sin `organization_id` (el backfill de arranque la asignaría a la org 1) | Se añade `organization_id = req.orgId` |
| routes/clients.js | GET /, GET /:id, PUT /:id, DELETE /:id | Sin hallazgos: ya filtran por org | — |
| routes/client-groups.js | POST / (client_ids iniciales) | Se insertaban en `client_group_members` clientes sin verificar org (PUT /:id/clients sí verificaba) | Guard `clients WHERE id = ? AND organization_id = ?`; ajenos se omiten |
| routes/client-groups.js | resto | Sin hallazgos: grupos por org, miembros vía JOIN clients.organization_id | — |
| routes/client-calls.js | POST /:clientId | Creaba llamadas para un `clientId` de otra org (fila con org propia apuntando a cliente ajeno) | `assertClientInOrg` → 404 vía `sendTenantError` |
| routes/client-calls.js | GET/PUT/DELETE | Sin hallazgos: filtran por `client_id` + `organization_id` | — |
| routes/client-logbook.js | POST /:clientId, POST/PUT acciones | `assignee_id` del body sin verificar que fuera miembro de la org | Helper `safeAssignee()`: solo ids de `team_members` de la org, si no → null |
| routes/client-logbook.js | resto | Sin hallazgos: entradas y acciones por org y por cliente verificado | — |
| routes/client-documents.js | (todas) | Sin hallazgos: cliente verificado + `organization_id` en documentos | — |
| routes/client-reports.js | (todas) | Sin hallazgos | — |
| routes/portal-admin.js | GET/PUT /clients/:id/settings, POST /clients/:id/apply-template | INSERTs en `client_portal_settings` sin `organization_id` (3 lugares) | Se añade `organization_id` en los tres INSERT |
| routes/portal-admin.js | POST /clients/:id/invite | INSERT en `client_access_tokens` sin `organization_id`; `created_by` venía del body sin verificar | `organization_id = req.orgId`; `created_by` = miembro de la org (por defecto `req.teamMember.id`) |
| routes/portal-admin.js | GET/PUT /priorities/:clientId | No verificaba que el cliente fuera de la org (PUT podía crear prioridades para un cliente ajeno) | Verificación de cliente → 404 |
| routes/portal-admin.js | POST /commercial-dates, PUT /commercial-dates/group | `client_ids` del body sin verificar org | Se verifica cada cliente; ajenos se omiten |
| routes/portal-admin.js | POST /dashboard-templates | Usaba `result.lastID` (siempre undefined con pg) → respondía null; relectura sin org | `lastInsertRowid` + `AND organization_id = ?` |
| routes/portal-admin.js | access tokens, activity, dashboard-templates (resto) | Sin hallazgos: cliente/plantilla verificados por org | — |
| routes/dashboard-share.js | GET /public/:token | JOIN `clients` sin exigir misma org que el token; `ai_insights` solo por `client_id` | `c.organization_id = dst.organization_id` en el JOIN; `ai_insights ... AND organization_id = token.organization_id` |
| routes/dashboard-share.js | rutas autenticadas | Sin hallazgos: cliente verificado por org, listados/revocación por org | — |
| routes/dashboard.js | /stats, /recent-activity, /upcoming-tasks | Tareas filtradas vía `projects.organization_id` (excluía tareas sin proyecto, y dependía del padre) | Filtro directo `t.organization_id = ?` (LEFT JOIN projects) |
| routes/dashboard.js | resto | Sin hallazgos | — |
| routes/search.js | GET /, GET /quick | Tareas filtradas vía `p.organization_id` (LEFT JOIN) | `t.organization_id = ?` directo; clientes/proyectos/equipo/facturas ya filtraban por org |
| routes/notifications.js | POST / | `user_id` del body sin verificar que fuera miembro de la org | Verificación `team_members WHERE id = ? AND organization_id = ?` → 404 |
| routes/notifications.js | resto | Sin hallazgos: todo por `organization_id` | — |
| utils/notificationHelper.js | createNotification() | Confiaba en el `orgId` del llamador; con `orgId` null la fila quedaba NULL (backfill → org 1) y se podía notificar a un miembro de otra org | Verifica que el destinatario es miembro de la org (si `orgId` difiere → no se crea); si `orgId` es null lo deriva del miembro |
| routes/news.js | (todas) | Sin hallazgos: org en feed, versiones, lecturas; cliente validado por org | — |
| routes/orbit-feedback.js | (todas) | Sin hallazgos: `findOwned` por org; votos/comentarios cuelgan de la fila verificada | — |
| routes/audit-log.js | (todas) | Sin hallazgos | — |
| routes/team.js | POST /:id/set-pin | Un admin de la org B podía cambiar `users.pin_hash` (PIN GLOBAL de login) de un usuario que también es miembro de la org A → secuestro de cuenta entre tenants | Si el usuario tiene membresías en otras orgs → 403; el UPDATE de `team_members` ahora lleva `organization_id` |
| routes/team.js | POST / (crear miembro con email existente) | Sobrescribía `users.pin_hash` y `users.avatar_url` de un usuario global ya ligado a otra org | `identityLocked`: no se toca el PIN si el usuario ya tiene PIN y pertenece a otra org; avatar solo si no está compartido |
| routes/team.js | PUT /:id | Cambiaba `users.email` (llave de login global) y `users.avatar_url` de un usuario compartido; chequeo de email duplicado consultaba `team_members` de TODAS las orgs (filtración de existencia + bloqueaba casos legítimos); relectura sin org | Email: 403 si el usuario está en otras orgs; duplicado solo dentro de la org; avatar solo si no compartido; relectura con `organization_id` |
| routes/team.js | resto (GET /, GET /:id, DELETE /:id, leave-org, profile, change-pin, org-logo) | Sin hallazgos: todas las rutas aplican `teamAuthMiddleware` por ruta y filtran por `req.orgId` | — |
| middleware/clientAuth.js | clientAuthMiddleware | `req.client` no exponía la organización del cliente | Se añade `req.client.organization_id` (desde `clients.organization_id`) para que el portal pueda filtrar tablas con org |
| routes/portal/auth.js | POST /login | Sesión (`client_access_tokens`) y settings por defecto se insertaban sin `organization_id` | Heredan la org del cliente (`c.organization_id`) |
| routes/portal/tasks.js | POST /:id/comments | INSERT en `client_comments` sin `organization_id` | `organization_id = req.client.organization_id` (fallback `task.organization_id`) |
| routes/portal/tasks.js | resto | Sin hallazgos: toda tarea se resuelve vía `projects.client_id = req.client.id` + `visible_to_client` | — |
| routes/portal/calls.js, dashboard.js, invoices.js, notifications.js, projects.js, reports.js, payment-proofs.js | (todas) | Sin hallazgos: todo cuelga de `req.client.id` (comprobantes verifican la factura del cliente y copian su org) | — |
| routes/portal/ugc.js | (todas) | Sin hallazgos: creadores solo si tienen asignación/proyecto del cliente | — |
| routes/portal/whatsapp-sales.js, email-marketing.js, reference-ads.js, financials.js, metrics.js | (todas) | Sin hallazgos: por `req.client.id`; financials/reference-ads cargan la org desde `clients` | — |
| routes/portal/index.js | — | Solo monta routers | — |

### Cambios de esquema requeridos
Ninguno. Todas las tablas usadas ya tienen `organization_id` o se verifican vía su padre (`client_group_members`, `org_news_reads`, `orbit_feedback_votes`).

### Tokens públicos
- **dashboard-share** (`dashboard_share_tokens.token`): 8 caracteres de un alfabeto de 32 (`XXXX-XXXX`), `crypto.randomInt` → ~2^40 combinaciones; se comprueba unicidad antes de insertar; el lookup público devuelve una sola fila (`WHERE token = ? AND status='active'` + expiración) y todas las consultas derivadas usan el `client_id`/`organization_id` del token, nunca del query. **Pendiente (no cambiado para no romper el formato que ve el usuario):** 2^40 sin rate limiting es enumerable en teoría; recomendable subir a ≥12 caracteres o añadir rate limit en `/public/:token`.
- **portal/auth** código de invitación (`client_access_tokens`, `token_type='invite'`): mismo formato `XXXX-XXXX` (2^40), permanente, sin expiración ni rate limit → misma recomendación. El token de **sesión** es `randomBytes(32).hex` (256 bits), correcto. El login no filtra existencia (401 genérico).
- No hay rutas de "magic link" por email en el portal.

### Notas para otros grupos
- `req.client.organization_id` ya está disponible en todas las rutas del portal (grupo B: `portal/notes.js`, `portal/forms.js`, `portal/structured-briefs.js`, `portal/documents.js` pueden usarlo en vez de consultar `clients`).
- `createNotification(userId, ..., orgId)` ahora **devuelve null sin insertar** si `userId` no es miembro de `orgId`; si `orgId` es null lo deriva del miembro. Firma sin cambios; llamadores de grupos A/B/D/E no necesitan tocarse.
- Fuera de alcance (no tenant), anotado: en `team.js` PUT /:id cualquier miembro (no solo admin) puede cambiar rol/permisos de otro; `dashboard_share_tokens` e invitaciones de portal son enumerables en teoría (ver arriba).
- No se tocó `database.js` ni `server.js`.

## 9. Finanzas: facturas, PDF público, gastos, comisiones, nómina, bancos, cobros, Siigo, CRM, reportes, metas, email marketing, cron

| Archivo | Ruta/función | Hallazgo | Corrección |
|---|---|---|---|
| routes/invoices.js | POST / | `client_id` y `project_id` del body sin verificar org (factura podía colgar de cliente/proyecto ajeno) | `assertClientInOrg` + `assertProjectInOrg`, 404 vía `sendTenantError` |
| routes/invoices.js | PUT /:id | `client_id`/`project_id` del body sin verificar al reasignar; `changed_by` (team_member) sin verificar | assert de cliente/proyecto solo si cambian; `changed_by` se guarda solo si es miembro de la org (si no, NULL) |
| routes/invoices.js | DELETE /:id | DELETE scoped pero respondía 200 aunque no borrara nada | 404 si `changes === 0` |
| routes/invoices.js | GET /, GET /:id, /:id/history, /:id/send, /:id/duplicate | Sin hallazgos: ya filtran por org | — |
| routes/invoice-pdf.js | GET /:token (público) | Token HMAC firmado con secreto por defecto **público** (`'orbit-pdf-secret-2024'`) si falta `PDF_LINK_SECRET`: cualquiera podía firmar `invoiceId:orgId` y bajar PDFs de cualquier org; comparación no constante; 403 revelaba firma inválida | Secreto derivado de `sha256(DATABASE_URL)` cuando no hay env var (+ warning en consola); `timingSafeEqual`; ids numéricos obligatorios; firma inválida → 404 |
| routes/expenses.js | POST /, PUT /:id | `project_id` del body sin verificar org (el gasto quedaba vinculado a proyecto ajeno y el listado exponía `project_name` de otra org) | `assertProjectInOrg`, 404 |
| routes/expenses.js | GET, DELETE, /summary/by-category | Sin hallazgos | — |
| routes/commissions.js | PUT /:id | `team_member_id` y `client_id` del body sin verificar org (POST sí verificaba) | `assertRowInOrg(commissions)`, `assertRowInOrg(team_members)`, `assertClientInOrg`, 404 |
| routes/commissions.js | resto | Sin hallazgos: ya filtra por org (incluida notificación con organization_id) | — |
| routes/payroll.js | (todas) | Sin hallazgos: `payroll_employees` siempre vía `payroll_periods.organization_id`; DELETE/replace por id obtenido con filtro de org | — |
| routes/bank-statements.js | (todas) | Sin hallazgos: `bank_transactions` siempre vía `bank_statement_periods.organization_id` | — |
| routes/collections.js | POST /notes | `client_id` del body sin verificar org | `assertClientInOrg`; SELECT de retorno con org |
| routes/collections.js | POST /mark-paid | UPDATE scoped, pero insertaba `invoice_status_history` para cualquier `invoice_id` (historial falso + `changed_by` de otra org visible en la factura ajena) | `assertInvoiceInOrg` antes de escribir; `from_status` real |
| routes/collections.js | POST /schedule-reminder | `client_id` del body sin verificar org (recordatorio programado a cliente ajeno; el cron luego fallaba con "Cliente no encontrado" pero la fila quedaba) | `assertClientInOrg`, 404 |
| routes/collections.js | DELETE /scheduled/:id | DELETE por id tras verificar; se añade `organization_id` al DELETE (defensa en profundidad) | `AND organization_id = ?` |
| routes/collections.js | summary, invoices, by-month, client/:id, send-bulk, send-reminder, send-whatsapp, reminders, notes/:clientId, process-scheduled, scheduled, sync-siigo | Sin hallazgos: todo cuelga de `clients`/`invoices` con `organization_id = req.orgId` | — |
| routes/siigo.js | (todas, 23 rutas) | Sin hallazgos: settings/tipos/impuestos/facturas/gastos siempre por `organization_id = req.orgId`; `siigoService.*` recibe `orgId` | — |
| services/siigoService.js | getCredentials/saveCredentials/authenticate/sync* | Sin hallazgos: credenciales y caché de token por org; ids de settings salen de consulta por org | — |
| services/siigoAutoSync.js | refreshOpenInvoiceBalances, syncClientContactsFromSiigo | UPDATE por id (id venía de consulta por org, no explotable) | `AND organization_id = ?` (defensa en profundidad) |
| services/siigoAutoSync.js | syncSiigoForAllOrgs, importSiigoInvoice, syncExpensesForOrg, jobs | Sin hallazgos: itera `siigo_settings` por org y toda fila nueva lleva `organization_id` | — |
| services/scheduledReminders.js | processScheduledReminders | Sin hallazgos: org sale de `scheduled_reminders.organization_id`; cliente/facturas filtradas por esa org | — |
| utils/recurringInvoices.js | processInvoiceRecurring | Org de la factura nueva se tomaba de `clients.organization_id` vía LEFT JOIN: con `client_id` NULL quedaba `organization_id = NULL` y el backfill de arranque la regalaba a la org 1 | `COALESCE(i.organization_id, c.organization_id)`, JOIN exige misma org, se omite (warn) si no hay org; UPDATE de la original con org |
| utils/recurringInvoices.js | createRecurringInvoice | Cliente sin `organization_id` generaba factura sin org | Se omite con warning |
| routes/sales-goals.js | (todas) | Sin hallazgos: `UNIQUE(organization_id, year, month)` y upserts por org | — |
| routes/reports.js | (todas) | Sin hallazgos: todas las agregaciones filtran por org (tasks vía `projects.organization_id`, team_members por org) | — |
| routes/email-marketing.js | (todas) | Sin hallazgos: cliente verificado en org en cada ruta; UPDATE por id solo tras SELECT con org | — |
| services/financialsExport.js | buildFinancialsWorkbook/getClientBrandName | Sin hallazgos: `clients` por org; delega en `computeFinancials({orgId})` | — |
| routes/crm.js | router.use | Middleware por ruta correcto: `teamAuthMiddleware` en todo salvo `/webhook/transcript` (protegido por `x-webhook-secret`) | — |
| routes/crm.js | PUT /stages/:id, DELETE /stages/:id | Permitía **editar/borrar etapas globales** (`organization_id IS NULL`, compartidas por todas las orgs) → escritura cross-tenant; conteo de deals en uso sin org | Globales de solo lectura (403 con mensaje explícito); UPDATE/DELETE/COUNT con `organization_id = req.orgId` |
| routes/crm.js | POST /deals | `stage_id` del body sin verificar (podía apuntar a etapa de otra org); `assigned_to` sin verificar; SELECT de retorno sin org | `findVisibleStage` (propia o global) → 404; `assertRowInOrg(team_members)`; SELECT con org |
| routes/crm.js | PUT /deals/:id | UPDATE scoped pero el `SELECT * FROM crm_deals WHERE id = ?` posterior **devolvía el deal de otra org** aunque no se hubiera actualizado; `assigned_to` sin verificar | `assertRowInOrg(crm_deals)` primero; `assigned_to` verificado; SELECT con org |
| routes/crm.js | DELETE /deals/:id, DELETE /activities/:id | 200 aunque no borrara nada | 404 si `changes === 0` |
| routes/crm.js | PATCH /deals/:id/stage | `stage_id` destino sin verificar; UPDATEs y SELECT final por id sin org | `findVisibleStage` → 404; todos los UPDATE/SELECT con org |
| routes/crm.js | POST /deals/:id/activities | Insertaba actividad para un deal de otra org (deal no verificado) | `assertRowInOrg(crm_deals)`, 404 |
| routes/crm.js | POST /deals/:id/convert | UPDATE/SELECT finales por id sin org | `AND organization_id = ?` |
| routes/crm.js | POST /webhook/transcript (público, secreto compartido) | `organization_id` y `deal_id` venían del body: con el secreto se podía escribir actividades en el deal de cualquier org o con org inventada | La org se toma de `crm_deals.organization_id`; si el body trae `organization_id` debe coincidir; deal inexistente → 404 |
| routes/crm.js | POST /proposals/generate | Plantilla buscada solo por `slug` (podía usar la plantilla privada de otra org con el mismo slug) | `slug AND (organization_id = ? OR IS NULL)`, prefiere la propia |
| routes/crm.js | POST /proposals/deploy | Registraba actividad `proposal_sent` en `deal_id` ajeno (y publicaba primero) | Verifica deal en org antes de publicar → 404 |
| routes/crm.js | GET /stages, /deals, /deals/:id, /deals/:id/activities, /proposals/templates, /proposals/generate-custom | Sin hallazgos | — |

### Cambios de esquema requeridos
Ninguno. Las tablas sin `organization_id` de este grupo (`invoice_status_history`, `payroll_employees`, `bank_transactions`) se resuelven siempre vía su padre.

### Tokens públicos
- **invoice-pdf** (`GET /api/invoice-pdf/:token`): el token es `base64url(invoiceId:orgId:hmac16)`. Antes: si no existía `PDF_LINK_SECRET`, el HMAC usaba la constante pública `'orbit-pdf-secret-2024'` (está en el repo), así que cualquiera podía firmar enlaces para cualquier `invoiceId:orgId` y enumerar facturas de todas las orgs; además la comparación de firma no era constante y devolvía 403. Ahora: secreto = `PDF_LINK_SECRET` o, si falta, `sha256('orbit-pdf:' + DATABASE_URL)` (estable entre reinicios, no público) con warning al arrancar; `timingSafeEqual`; ids numéricos; firma inválida → 404. La consulta sigue exigiendo `id = ? AND organization_id = ?`. **Recomendación para producción:** definir `PDF_LINK_SECRET` (≥32 bytes aleatorios) en Railway. Impacto: si en producción NO existía `PDF_LINK_SECRET`, los enlaces de PDF ya enviados por correo dejan de funcionar (se firmaron con el secreto público) — es deseable. `generatePdfToken(invoiceId, orgId)` conserva su firma; lo usan `collections.js` y `scheduledReminders.js`.
- **crm webhook** (`POST /api/crm/webhook/transcript`): protegido por `x-webhook-secret` global; ahora la organización se deriva del deal y no del body.

### Notas para otros grupos / frontend
- **crm.js etapas globales**: `PUT/DELETE /api/crm/stages/:id` sobre una etapa con `organization_id NULL` ahora responde **403** `"Las etapas predeterminadas son compartidas y no se pueden editar/eliminar"`. Si el frontend permite editar esas etapas predeterminadas, mostrará ese error; alternativa de producto: que `database.js` siembre las etapas por organización (hoy las siembra con `organization_id NULL` cuando la tabla está vacía) y que `/register` cree las etapas propias de la org nueva — para quien toque `database.js`/`auth.js`.
- `crm.js`: `DELETE /deals/:id` y `DELETE /activities/:id` ahora devuelven 404 si no existe en la org (antes 200).
- `invoices.js`: `DELETE /:id` devuelve 404 si no existe en la org (antes 200).
- Fuera de alcance pero relevante para SaaS: `collections.js`/`scheduledReminders.js` tienen datos bancarios, NIT, remitente ("Estefania Hernandez") y CC (`juanfe@larealmarketing.com`) de LA REAL hardcodeados en los correos de cobro; `payroll.js` asume `'LA REAL MARKETING SAS'`; `crm.js /proposals/deploy` publica en el GitHub `juanfelareal` y copia el logo de LA REAL para cualquier org. Debieran salir de `organizations.settings`.
- `payroll.js /upload`: bug no relacionado — en la rama XLSX `text` no está definido y `extractedText: text.substring(...)` lanzaría ReferenceError si no hay empleados.

## 10. Métricas, Growth, credenciales y OAuth, servicios financieros, WhatsApp, Zernio

| Archivo | Ruta/función | Hallazgo | Corrección |
|---|---|---|---|
| routes/client-metrics.js | POST /sync-all | Disparaba `syncAllClientsSmart` para TODOS los clientes de TODAS las orgs (una org podía forzar sync/consumo de API de otra) | Se pasa `req.orgId`; el servicio filtra `clients.organization_id` |
| routes/client-metrics.js | POST /sync/:clientId | Job de sync creado sin organization_id (el backfill de arranque lo reasignaba a la org 1) | `syncClientDateRange(..., orgId)` → `metrics_sync_jobs.organization_id` |
| routes/client-metrics.js | GET /:clientId, /daily, /ads, /google-campaigns, /tiktok-campaigns, /top-products, /email-monthly*, /aggregate/all, /summary/all, /sync-status, /email-dashboard, POST /backfill-sessions | Sin hallazgos: verifican el cliente en la org antes de leer por client_id, o filtran por `c.organization_id` | — |
| routes/growth.js | (todas: /clients/*, /:clientId/*, objectives, palancas, milestones, banderas, fixed/variable costs, lab, reserves, products, financials, scenarios, patterns, customer-mix, orders/backfill, export.xlsx) | Sin hallazgos: `verifyClient(clientId, req.orgId)` en cada ruta y UPDATE/DELETE por id con `AND organization_id`; los servicios reciben orgId | — |
| routes/platform-credentials.js | POST /facebook, POST /shopify | INSERT de credenciales sin organization_id | Se agrega `organization_id = req.orgId` |
| routes/platform-credentials.js | POST /health-check, POST /refresh-facebook-tokens | Probaban/refrescaban credenciales de TODAS las orgs y devolvían el resumen (nombres de clientes/cuentas ajenas) | Se pasa `req.orgId`; el servicio filtra por `c.organization_id` |
| routes/platform-credentials.js | resto (GET /client/:clientId, */test, */sessions-diagnostics, DELETE */:id, POST /woocommerce) | Sin hallazgos: JOIN clients + organization_id | — |
| routes/facebook-oauth.js | GET /url, GET /callback | `state`/`sessionId` con `Math.random()` (baja entropía, enumerable) | `crypto.randomBytes(24)` |
| routes/facebook-oauth.js | GET /ad-accounts | No comprobaba que la sesión OAuth fuera de la org del solicitante | `session.orgId === req.orgId` → 404 |
| routes/facebook-oauth.js | POST /link-accounts | El token OAuth de una sesión podía enlazarse a un cliente distinto / de otra org; INSERT sin organization_id | Exige `session.orgId === req.orgId` y `session.clientId === client_id` (404); INSERT con organization_id |
| routes/google-ads-oauth.js | GET /url, /callback, /customers, POST /link-accounts | Igual que Facebook (state débil, sin check de org en sesión, INSERT sin org) | Igual que Facebook |
| routes/tiktok-oauth.js | GET /url, /callback, /advertisers, POST /link-accounts | Igual que Facebook | Igual que Facebook |
| routes/shopify-oauth.js | GET /url, /callback, /callback-status | `state` con `Math.random()`; `/callback-status` (público) devolvía sessionId/clientId por state enumerable | `crypto.randomBytes(24)` para state y sessionId |
| routes/shopify-oauth.js | GET /store-info, POST /link-store | Sin check de org/cliente de la sesión | `session.orgId === req.orgId` (+ `session.clientId === client_id` en link-store) → 404 |
| routes/shopify-oauth.js | POST /save-credentials, POST /link-store (INSERT), DELETE /unlink/:id | Sin hallazgos: ya llevan organization_id / JOIN clients | — |
| routes/woocommerce-auth.js | GET /store-info, POST /link-store | Ya verificaba org y cliente de la sesión, pero respondía 403 | Ahora 404 (no revelar); comparación numérica |
| routes/woocommerce-auth.js | /url, /callback, /return, /callback-status | Sin hallazgos: state = `crypto.randomBytes(16)`, INSERT con organization_id | — |
| services/metricsSyncService.js | `createSyncJob` | INSERT `metrics_sync_jobs` sin organization_id | Param `orgId` opcional; si falta se deriva de `clients.organization_id` |
| services/metricsSyncService.js | `upsertDailyMetrics` | INSERT `client_daily_metrics` sin organization_id (backfill → org 1) | Param `orgId` opcional (derivado del cliente); `syncClientForDate` pasa `client.organization_id` |
| services/metricsSyncService.js | `getClientsWithCredentials`, `syncAllClientsForDate`, `syncAllClientsSmart`, `syncClientDateRange` | Sin filtro por org (válido para el cron global, no para rutas) | Param `orgId = null` opcional: el cron sigue global, las rutas lo pasan |
| services/metricsSyncService.js | `syncClientForDate`, `backfillSessions`, `getExistingDates` | Sin hallazgos: credenciales siempre del mismo client_id; filas derivadas (product sales, orders) ya llevan `client.organization_id` | — |
| services/integrationHealthCheck.js | `runIntegrationHealthCheck`, `refreshExpiringFacebookTokens` | Sin filtro por org | Param `orgId = null`: cron global; desde ruta solo la org (FB, Google, TikTok, Woo, Shopify, Siigo) |
| services/insightService.js | `generateWeeklyInsight` | `SELECT ... FROM clients WHERE id = ?` sin org | `AND organization_id = ?`; si no coincide no genera |
| services/insightService.js | `generateAllWeeklyInsights` | Sin hallazgos: itera (id, organization_id) y el INSERT en ai_insights lleva org | — |
| services/whatsappSales.js | `recalcWhatsappSpend`, `mirrorToDailyMetrics` | INSERT `client_daily_metrics` sin organization_id | Helper `clientOrgId()` y columna organization_id en ambos INSERT |
| services/whatsappSales.js | resto | Sin hallazgos: scoped por client_id verificado en la ruta; INSERTs con organization_id | — |
| services/whatsappBriefings.js | `deliverPendingBriefings` (expirar viejos) | UPDATE por teléfono sin org | `AND organization_id = ?` |
| services/whatsappBriefings.js | resto | Sin hallazgos: todo por `orgId` | — |
| services/whatsappService.js | (todas) | Sin hallazgos: orgId de Kapso en inbound/outbound; listados y lecturas por organization_id | — |
| routes/whatsapp.js, routes/whatsapp-sales.js, routes/whatsapp-webhook.js | (todas) | Sin hallazgos: `requireOwnerOrg` (solo la org dueña del número de Kapso), `ownClient` verifica cliente en org; el webhook usa `KAPSO_ORGANIZATION_ID` | — |
| routes/zernio.js | `getZernioInstance`, GET/POST/DELETE /settings, POST /test (y por tanto todas las rutas `requireZernio`) | Settings/API key de Zernio leídos y escritos SIN organization_id: todas las orgs compartían (y podían ver, sobrescribir o borrar) la misma API key y operar las redes sociales de otra org | Todo filtrado por `req.orgId`; INSERT con organization_id; desactivar solo las de la org |
| services/clientFinancialsService.js, clientFinancialsEdits.js, financialScenarios.js, financialLab.js, orderLedger.js, discountsBackfill.js, utils/revenueMetric.js, utils/facebookClient.js | (todas) | Sin hallazgos: reciben clientId ya verificado en la org por la ruta (growth.js) y las escrituras llevan organization_id (shopify_products, client_product_daily_sales, daily_cogs, client_orders, client_financial_*, client_reserve_payments) | — |

### Cambios de esquema requeridos
Ninguno (todas las tablas tocadas ya tienen `organization_id`). `whatsapp_briefing_runs` y `whatsapp_webhook_events` solo guardan claves de idempotencia/deduplicación (sin datos de clientes) y la integración de WhatsApp es de una sola org (`KAPSO_ORGANIZATION_ID`); no requieren columna.

### OAuth / webhooks
- Facebook, Google Ads, TikTok, Shopify: `state` y `sessionId` ahora `crypto.randomBytes(24).toString('hex')` (antes `clientId_timestamp_Math.random`, ~30 bits). La sesión en memoria guarda `clientId` + `orgId`; `/callback` (público) solo acepta un state existente. Las rutas autenticadas que consumen la sesión (`ad-accounts`, `customers`, `advertisers`, `store-info`) exigen `session.orgId === req.orgId` (404), y las de enlace (`link-accounts`, `link-store`) además `session.clientId === client_id` (404). Los INSERT/UPSERT de credenciales llevan `organization_id`.
- Shopify `/callback` verifica HMAC con el secret del cliente y que la tienda coincida con la sesión; `/callback-status` (público) solo revela algo si se conoce el state aleatorio.
- WooCommerce: ya usaba `crypto.randomBytes(16)` y verificaba org+cliente; se cambió 403 → 404.
- Webhook de Kapso (WhatsApp): público, firma HMAC obligatoria, org fija por `KAPSO_ORGANIZATION_ID`; `routes/whatsapp.js` bloquea (403) a cualquier otra org vía `requireOwnerOrg`. Integración single-tenant por diseño; para venderla multi-tenant habría que mapear número de Kapso → organización.

### Notas para otros grupos
- Firmas nuevas (parámetro opcional al final, compatibles con los llamadores existentes): `syncAllClientsSmart(start, end, orgId=null)`, `syncAllClientsForDate(date, orgId=null)` (el cron de server.js sigue sin orgId), `syncClientDateRange(clientId, start, end, orgId=null)`, `getClientsWithCredentials(orgId=null)`, `createSyncJob(clientId, jobType, orgId=null)`, `upsertDailyMetrics(clientId, date, metrics, orgId=null)`, `runIntegrationHealthCheck(orgId=null)`, `refreshExpiringFacebookTokens(orgId=null)`.
- `growth.js` lee `client_portal_settings.scenarios_enabled` por client_id tras verificar el cliente en la org: correcto; si el grupo C añade org a esa tabla no hace falta cambiar nada aquí.
- No se tocó el frontend: los contratos de respuesta se mantienen (solo cambia 403→404 en WooCommerce store-info/link-store para sesiones ajenas).

## 11. UGC (interno y público), anuncios referentes, etiquetas de ads, agentes, blobs

Archivos revisados: routes/ugc.js, routes/ugc-public.js, routes/ugc-contracts-public.js, routes/reference-ads.js, routes/ad-tags.js, routes/agents.js, routes/screenstudio.js, routes/pdf-analysis.js, utils/blobStorage.js, utils/emailHelper.js, services/googleDrive.js, services/claudeService.js, agents/{base,index,marca-personal,runner,socket}.js.

| Archivo | Ruta/función | Hallazgo | Corrección |
|---|---|---|---|
| routes/ugc.js | POST /sync-assignments | Iteraba `ugc_project_creators` de TODAS las orgs (leía/creaba/actualizaba `ugc_assignments` ajenas) | `AND p.organization_id = ?` |
| routes/ugc.js | POST /migrate-statuses | `UPDATE ugc_project_creators SET status…` global (todas las orgs) | Subconsulta `project_id IN (SELECT id FROM ugc_projects WHERE organization_id = ?)` (los DDL de constraint siguen siendo globales, no tocan datos) |
| routes/ugc.js | PUT /stages/:id | UPDATE con org, pero el SELECT de respuesta era por id suelto → devolvía etapa de otra org | SELECT con `organization_id`, 404 |
| routes/ugc.js | DELETE /lists/:id/creators/:creatorId | `creatorId` no verificado; devolvía `list_ids` de un creador ajeno | Verifica creador en org, 404 |
| routes/ugc.js | POST /creators | `stage_id` del body sin verificar (etapa de otra org) | `optionalOrgRef('ugc_creator_stages')` → 404 |
| routes/ugc.js | PUT /creators/:id | `stage_id` del body sin verificar; SELECT de respuesta por id suelto | Verifica etapa; SELECT con org |
| routes/ugc.js | PATCH /creators/:id/stage | `stage_id` sin verificar; SELECT de respuesta por id suelto → leak de creador ajeno | Verifica etapa; `result.changes` → 404; SELECT con org |
| routes/ugc.js | POST /assignments | `creator_id`, `client_id`, `project_id` del body sin verificar → asignación cruzada e INSERT en `ugc_project_creators` de proyecto ajeno | `assertRowInOrg(ugc_creators)`, `assertClientInOrg`, `optionalOrgRef(ugc_projects)` → 404 |
| routes/ugc.js | PUT /assignments/:id, PATCH /assignments/:id/status | SELECT de respuesta por id suelto → leak | SELECT con org, 404 |
| routes/ugc.js | POST /payments | `creator_id`, `assignment_id` del body sin verificar → pago registrado sobre creador/asignación ajena | `assertRowInOrg`, `optionalOrgRef` → 404 |
| routes/ugc.js | PUT /payments/:id | SELECT de respuesta por id suelto → leak | SELECT con org, 404 |
| routes/ugc.js | POST /projects | `client_id`, `package_id` del body sin verificar → proyecto UGC colgado de cliente de otra org | `assertClientInOrg`, `optionalOrgRef(ugc_packages)` → 404 |
| routes/ugc.js | PUT /projects/:id | SELECT de respuesta por id suelto → leak | SELECT con org, 404 |
| routes/ugc.js | POST /projects/:id/creators | `creator_ids` sin verificar → agregaba creadores de otra org al proyecto | Filtra por `ugc_creators.organization_id`; los ajenos van a `skipped` |
| routes/ugc.js | PUT /projects/:projectId/creators/:creatorId | **Sin ninguna verificación de org**: UPDATE de `ugc_project_creators`, creación/actualización de `ugc_assignments`, carpetas de Drive y respuesta con datos del creador de otra org | Verifica `ugc_projects.organization_id` al inicio → 404 |
| routes/ugc.js | DELETE /projects/:projectId/creators/:creatorId | DELETE por `project_id + creator_id` sin org → borrado cruzado | Verifica proyecto en org → 404 |
| routes/ugc.js | POST /creators/:id/notes | `creator_id` (param) y `project_id` (body) sin verificar → nota interna sobre creador ajeno / título de proyecto ajeno en respuesta | `assertRowInOrg(ugc_creators)`, `optionalOrgRef(ugc_projects)`; SELECT con org |
| routes/ugc.js | PUT /notes/:id | `project_id` del body sin verificar; SELECT de respuesta por id suelto | Verifica proyecto; `result.changes` → 404; SELECT con org |
| routes/ugc.js | GET /stages, /industries, /lists, /creators, /creators/:id, /assignments, /payments, /registration-links, /clients, /stats, /packages, /projects, settlement (6 rutas), /projects/:id, drive-folder, create-all-folders, contract tokens (2), /…/contract, /signed-contracts/:id, /projects/:id/signed-contracts, /creators/:id/notes, DELETEs por id | Sin hallazgos: filtran por `organization_id` o por padre verificado | — |
| routes/ugc-public.js | GET/POST /register/:token | Sin hallazgos: org sale del token (16 bytes hex, UNIQUE, status=active); industrias/etapa/creador cuelgan de esa org; `uses_count` por id del token | — |
| routes/ugc-contracts-public.js | GET /:token, POST /:token/sign | Sin hallazgos: fila única por `contract_token` (UNIQUE); firma hereda `p.organization_id`; UPDATE por `pc.id` resuelto desde el token | — |
| routes/reference-ads.js | (todas) | Sin hallazgos: `reference_ads.organization_id` en cada lectura/escritura; `client_ids`/`group_ids` ya se validan contra la org antes de insertar en `reference_ad_clients`/`reference_ad_groups` | — |
| routes/ad-tags.js | PUT /assignments/:adId, POST /assignments/bulk | `client_id` y `value_id` del body sin verificar → asignaciones apuntando a etiquetas/cliente de otra org (y el GET luego exponía el nombre de la etiqueta ajena vía JOIN) | `assertClientInOrg` + `assertAllRowsInOrg(ad_tag_values)` → 404; sólo se insertan value_ids válidos |
| routes/ad-tags.js | categorías/valores (CRUD), GET /assignments/:clientId | Sin hallazgos: ya filtran por org | — |
| routes/agents.js, agents/** | (todas) | No tocan la BD. Los agentes corren con Claude Agent SDK y herramientas Read/Write/Glob/Grep/WebSearch sobre el filesystem del servidor, sin contexto de org | Sin cambio (ver nota) |
| routes/screenstudio.js, routes/pdf-analysis.js | (todas) | No tocan la BD (proxy/IA sin persistencia) | — |
| utils/emailHelper.js, services/googleDrive.js, services/claudeService.js | — | No tocan la BD | — |
| utils/blobStorage.js | uploadBuffer | Rutas `${prefix}/${uuidv4}${ext}` no adivinables; sin org en la ruta | Parámetro opcional `orgId` → `${prefix}/org-<id>/<uuid><ext>`; documentado. Llamadores (otros grupos) siguen funcionando sin cambios |

### Cambios de esquema requeridos
Ninguno. `ugc_creator_list_members`, `ugc_project_creators`, `reference_ad_clients` y `reference_ad_groups` se verifican vía su padre (`ugc_creator_lists`/`ugc_creators`, `ugc_projects`, `reference_ads`), que sí tienen `organization_id`.

### Tokens públicos / blobs
- **Registro de creadores** (`ugc_registration_tokens.token`): `crypto.randomBytes(16).toString('hex')` (128 bits), columna `TEXT NOT NULL UNIQUE`, se exige `status = 'active'`; la org y el `tag` salen de la fila del token. No enumerable.
- **Firma de contratos** (`ugc_project_creators.contract_token`): `crypto.randomBytes(16).toString('hex')`, columna `TEXT UNIQUE` + índice; una fila por token; la firma (`ugc_signed_contracts`) hereda `organization_id` del proyecto. No enumerable. Las rutas públicas (`/api/ugc/register/:token`, `/api/ugc/contracts/:token[/sign]`) no colisionan con ninguna ruta autenticada de `ugc.js`.
- **Blobs (Vercel Blob)**: `${prefix}/[org-<id>/]<uuid v4><ext>`, `addRandomSuffix: false`, acceso público por URL. Seguridad por URL no adivinable (122 bits); la URL sólo se obtiene desde filas ya filtradas por org.

### Notas para otros grupos
- `uploadBuffer(prefix, file, orgId?)` acepta ahora un tercer argumento opcional. Llamadores en grupo C (`orbit-feedback.js`, `client-reports.js`, `client-documents.js`, `news.js`, `portal/payment-proofs.js`) pueden pasar `req.orgId` / la org del cliente para que la ruta del blob incluya `org-<id>`; no es obligatorio.
- Fuera de alcance (no tenant, pero seguridad): el namespace Socket.io `/agents` y `POST /api/agents/:slug/query|stream` ejecutan agentes del Agent SDK con herramientas de filesystem del servidor; el socket no autentica al usuario (la ruta HTTP sí pasa por teamAuth). Conviene autenticar el socket con el token de sesión antes de vender el producto.
- Bug preexistente no tocado: en `ugc.js` y `ugc-public.js` varios `INSERT` leen `result.lastID`, pero el wrapper devuelve `lastInsertRowid` (la respuesta 201 llega vacía / `creator_id: undefined`). No afecta aislamiento.
- `POST /api/ugc/sync-assignments` y `/migrate-statuses` son endpoints "temporales" de migración accesibles por cualquier miembro autenticado; ya quedan limitados a la org, pero convendría exigir `requireAdmin` o eliminarlos.

### Correcciones adicionales tras correr la prueba

| Archivo | Ruta/función | Hallazgo | Corrección |
|---|---|---|---|
| routes/notes.js | GET /client/:clientId, /project/:projectId, /team/:memberId, /:id/versions | Padre ajeno devolvía `200 []` (sin fuga, pero revela que el id "existe" vacío) | `assertRowInOrg` del padre → 404 |
| routes/forms.js | GET /client/:clientId, GET /:id/assignments | Idem | 404 si el cliente/formulario no es de la org |
| routes/document-templates.js | GET /signatures/client/:clientId | Idem | 404 |
| routes/growth.js | GET /clients/:clientId/commission | Cliente ajeno devolvía defaults `{commission_rate: 0, ...}` con 200 | 404 |
| routes/client-calls.js | GET /:clientId | Cliente ajeno → `200 []` | `assertClientInOrg` → 404 |
| routes/collections.js | GET /client/:clientId | Cliente ajeno → `200 {invoices: [], reminders: []}` | `assertClientInOrg` → 404 |
| routes/tags.js | PUT /:id, DELETE /:id | UPDATE/DELETE scoped pero respondían 200 sin tocar nada | 404 si no existe en la org |
| routes/search.js | GET /quick | Bug preexistente: `UNION ALL` con `LIMIT` por rama sin paréntesis → 500 en Postgres | Paréntesis por rama |

## 12. Prueba automatizada: `backend/scripts/test-tenant-isolation.mjs`

Qué hace:

1. Registra dos organizaciones (A y B) con sus admins vía `POST /api/auth/register` y comprueba `plan='trial'`, `trial_ends_at ≈ +14 días`, que B arranca vacía y que B no puede hacer `select-org` a A.
2. Crea en cada una: cliente, proyecto, tarea, subtarea, comentario, columna de tablero, etiqueta, factura, gasto, nota (con link al cliente), formulario (con sección/campo y asignación), plantilla de documento y SOP.
3. Con el token de **B** intenta **leer** (49 GET), **editar** (35 PUT/POST), **crear colgando de padres de A** (11 POST/PUT) y **borrar** (14 DELETE) los recursos de A por id, incluidas `/growth/clients/:id/financials`, `/growth/:id`, `/client-metrics/:id`, `/client-metrics/:id/daily|ads`, `/portal-admin/clients/:id/settings|access|activity`, `/portal-admin/priorities/:id`, `/collections/client/:id`, `/platform-credentials/client/:id`, etc. Exige 404/403.
4. Verifica que los listados de B (`/clients`, `/projects`, `/tasks`, `/invoices`, `/expenses`, `/notes`, `/forms`, `/document-templates`, `/sops`, `/tags`, `/growth/clients`, `/client-metrics/summary/all`, `/portal-admin/commercial-dates`, `/document-templates/signatures/all`, `/team`) y las búsquedas (`/search?q=`, `/search/quick?q=`, `/notes/search/query?q=`) no contienen nada de A (y que A sí encuentra lo suyo).
5. Control: con el token de A comprueba que todos sus recursos siguen intactos (nada fue editado/borrado por B).
6. Limpia los datos creados (salvo `--keep`).

Cómo correrla (base **local**; el script aborta si `DATABASE_URL` no es localhost salvo `ALLOW_REMOTE_TEST_DB=1`):

```bash
createdb orbit_tenant_test          # una sola vez (o: psql -d postgres -c "CREATE DATABASE orbit_tenant_test")
cd backend && npm install            # necesita node_modules (incluye xlsx)
DATABASE_URL=postgres://localhost:5432/orbit_tenant_test node scripts/test-tenant-isolation.mjs
```

- El script corre `initializeDatabase()` (idempotente, reintenta hasta 4 pasadas en una base vacía), arranca `server.js` en un puerto aleatorio (3900–3999) con `NODE_ENV=test` y sin claves externas, ejecuta las comprobaciones y apaga el servidor. Log del servidor en `TENANT_TEST_SERVER_LOG` o `$TMPDIR/orbit-tenant-test-server-*.log`.
- Opciones: `--base http://localhost:3001` (usar un servidor ya levantado), `--no-init` (no inicializar esquema), `--keep` (conservar datos).
- Código de salida 0 = todo OK; 1 = alguna comprobación falló (se listan al final).

### Resultado de la ejecución (2026-10-20, Postgres 15 local, base `orbit_tenant_test` creada vacía)

```
👥 Registrando organizaciones A y B...
  ✅ Las dos organizaciones tienen ids distintos  → A=12 B=13
  ✅ Org nueva: plan=trial y trial_ends_at ≈ now + 14 días  → plan=trial días=14
  ✅ Org nueva arranca vacía (sin clientes, proyectos, facturas, notas, UGC, plantillas...)  → ok
  ✅ B no puede cambiarse a la organización A (select-org)  → 403

📦 Creando datos en la organización A...
  ✅ [A] crear cliente  → 201
  ✅ [A] crear proyecto  → 201
  ✅ [A] crear tarea  → 201
  ✅ [A] crear subtarea  → 201
  ✅ [A] crear comentario  → 201
  ✅ [A] crear columna de tablero  → 201
  ✅ [A] crear etiqueta  → 201
  ✅ [A] crear factura  → 201
  ✅ [A] crear gasto  → 201
  ✅ [A] crear nota  → 201
  ✅ [A] crear formulario  → 201
  ✅ [A] crear plantilla de documento  → 201
  ✅ [A] crear SOP  → 201

📦 Creando datos en la organización B...
  ✅ [B] crear cliente  → 201
  ✅ [B] crear proyecto  → 201
  ✅ [B] crear tarea  → 201
  ✅ [B] crear subtarea  → 201
  ✅ [B] crear comentario  → 201
  ✅ [B] crear columna de tablero  → 201
  ✅ [B] crear etiqueta  → 201
  ✅ [B] crear factura  → 201
  ✅ [B] crear gasto  → 201
  ✅ [B] crear nota  → 201
  ✅ [B] crear formulario  → 201
  ✅ [B] crear plantilla de documento  → 201
  ✅ [B] crear SOP  → 201

🔒 B intenta LEER recursos de A por id (debe ser 404/403)...
  ✅ GET    /clients/8  → 404
  ✅ GET    /projects/8  → 404
  ✅ GET    /tasks/8  → 404
  ✅ GET    /subtasks/8  → 404
  ✅ GET    /subtasks/task/8  → 404
  ✅ GET    /subtasks/task/8/progress  → 404
  ✅ GET    /task-comments/task/8  → 404
  ✅ GET    /board-columns/8  → 404
  ✅ GET    /board-columns/project/8  → 404
  ✅ GET    /board-columns/values/task/8  → 404
  ✅ GET    /tags/8  → 404
  ✅ GET    /tags/task/8  → 404
  ✅ GET    /invoices/8  → 404
  ✅ GET    /invoices/8/history  → 404
  ✅ GET    /expenses/7  → 404
  ✅ GET    /notes/7  → 404
  ✅ GET    /notes/7/versions  → 404
  ✅ GET    /notes/client/8  → 404
  ✅ GET    /notes/project/8  → 404
  ✅ GET    /forms/7  → 404
  ✅ GET    /forms/7/assignments  → 404
  ✅ GET    /forms/client/8  → 404
  ✅ GET    /document-templates/6  → 404
  ✅ GET    /document-templates/signatures/client/8  → 404
  ✅ GET    /sops/5  → 404
  ✅ GET    /sops/5/revisions  → 404
  ✅ GET    /growth/8  → 404
  ✅ GET    /growth/clients/8/financials?period=2026-01  → 404
  ✅ GET    /growth/clients/8/fixed-costs  → 404
  ✅ GET    /growth/clients/8/commission  → 404
  ✅ GET    /client-metrics/8?start_date=2026-01-01&end_date=2026-01-31  → 404
  ✅ GET    /client-metrics/8/daily?start_date=2026-01-01&end_date=2026-01-31  → 404
  ✅ GET    /client-metrics/8/ads?start_date=2026-01-01&end_date=2026-01-31  → 404
  ✅ GET    /portal-admin/clients/8/settings  → 404
  ✅ GET    /portal-admin/clients/8/access  → 404
  ✅ GET    /portal-admin/clients/8/activity  → 404
  ✅ GET    /portal-admin/priorities/8  → 404
  ✅ GET    /task-history/task/8  → 404
  ✅ GET    /task-dependencies/task/8  → 404
  ✅ GET    /task-files/task/8  → 404
  ✅ GET    /client-documents/8  → 404
  ✅ GET    /client-calls/8  → 404
  ✅ GET    /client-logbook/8  → 404
  ✅ GET    /client-reports/8  → 404
  ✅ GET    /platform-credentials/client/8  → 404
  ✅ GET    /email-marketing/8  → 404
  ✅ GET    /whatsapp-sales/8  → 404
  ✅ GET    /collections/client/8  → 404
  ✅ GET    /structured-briefs/client/8  → 404

🔒 B intenta EDITAR recursos de A (debe ser 404/403)...
  ✅ PUT    /clients/8  → 404
  ✅ PUT    /clients/8/visibility  → 403
  ✅ PUT    /projects/8  → 404
  ✅ POST   /projects/8/team  → 404
  ✅ PUT    /tasks/8  → 404
  ✅ PUT    /subtasks/8  → 404
  ✅ PUT    /subtasks/8/toggle  → 404
  ✅ PUT    /subtasks/reorder/8  → 404
  ✅ PUT    /task-comments/8  → 404
  ✅ PUT    /board-columns/8  → 404
  ✅ POST   /board-columns/values  → 404
  ✅ PUT    /tags/8  → 404
  ✅ POST   /tags/task/8/tag/9  → 404
  ✅ POST   /tags/task/9/tag/8  → 404
  ✅ PUT    /invoices/8  → 404
  ✅ POST   /invoices/8/duplicate  → 404
  ✅ PUT    /expenses/7  → 404
  ✅ PUT    /notes/7  → 404
  ✅ PUT    /notes/7/pin  → 404
  ✅ POST   /notes/7/links  → 404
  ✅ PUT    /forms/7  → 404
  ✅ POST   /forms/7/assign  → 404
  ✅ POST   /forms/7/share  → 404
  ✅ POST   /forms/7/duplicate  → 404
  ✅ PUT    /document-templates/6  → 404
  ✅ POST   /document-templates/6/assign/9  → 404
  ✅ POST   /document-templates/7/assign/8  → 404
  ✅ PUT    /sops/5  → 404
  ✅ PUT    /growth/clients/8/settings  → 404
  ✅ POST   /growth/8/objectives  → 404
  ✅ POST   /growth/clients/8/fixed-costs  → 404
  ✅ PUT    /portal-admin/clients/8/settings  → 404
  ✅ POST   /portal-admin/clients/8/invite  → 404
  ✅ PUT    /portal-admin/priorities/8  → 404
  ✅ POST   /client-metrics/sync/8  → 404

🔒 B intenta CREAR recursos colgando de padres de A (debe ser 404/403)...
  ✅ POST   /projects  → 404
  ✅ POST   /tasks  → 404
  ✅ POST   /subtasks  → 404
  ✅ POST   /task-comments  → 404
  ✅ POST   /task-comments  → 404
  ✅ POST   /board-columns  → 404
  ✅ POST   /invoices  → 404
  ✅ POST   /expenses  → 404
  ✅ POST   /notes  → 404
  ✅ POST   /task-dependencies  → 404
  ✅ PUT    /tasks/9  → 404

🔒 B intenta BORRAR recursos de A (debe ser 404/403)...
  ✅ DELETE /task-comments/8  → 404
  ✅ DELETE /subtasks/8  → 404
  ✅ DELETE /board-columns/8  → 404
  ✅ DELETE /tags/8  → 404
  ✅ DELETE /tasks/8  → 404
  ✅ DELETE /projects/8/team/11  → 404
  ✅ DELETE /projects/8  → 404
  ✅ DELETE /invoices/8  → 404
  ✅ DELETE /expenses/7  → 404
  ✅ DELETE /notes/7  → 404
  ✅ DELETE /forms/7  → 404
  ✅ DELETE /document-templates/6  → 404
  ✅ DELETE /sops/5  → 404
  ✅ DELETE /clients/8  → 404

📋 Listados de B no deben incluir recursos de A...
  ✅ GET    /clients (sin datos de A)  → 200, 1 filas
  ✅ GET    /projects (sin datos de A)  → 200, 1 filas
  ✅ GET    /tasks (sin datos de A)  → 200, 1 filas
  ✅ GET    /invoices (sin datos de A)  → 200, 1 filas
  ✅ GET    /expenses (sin datos de A)  → 200, 1 filas
  ✅ GET    /notes (sin datos de A)  → 200, 1 filas
  ✅ GET    /forms (sin datos de A)  → 200, 1 filas
  ✅ GET    /document-templates (sin datos de A)  → 200, 1 filas
  ✅ GET    /sops (sin datos de A)  → 200, 1 filas
  ✅ GET    /tags (sin datos de A)  → 200, 1 filas
  ✅ GET    /growth/clients (sin datos de A)  → 200, 0 filas
  ✅ GET    /client-metrics/summary/all (sin datos de A)  → 200, 1 filas
  ✅ GET    /portal-admin/commercial-dates (sin datos de A)  → 200, 0 filas
  ✅ GET    /document-templates/signatures/all (sin datos de A)  → 200, 0 filas
  ✅ GET    /team (sin datos de A)  → 200, 1 filas
  ✅ GET    /search?q=tenant-mvh11avh-A (B no ve nada de A)  → 200
  ✅ GET    /search/quick?q=tenant-mvh11avh-A (B no ve nada de A)  → 200
  ✅ GET    /notes/search/query?q=tenant-mvh11avh-A (B no ve nada de A)  → 200
  ✅ GET    /search?q=tenant-mvh11avh-A con token de A encuentra sus datos (control)  → 200

🧪 Control: A sigue viendo sus recursos intactos...
  ✅ GET    /clients/8 (token A, intacto)  → 200
  ✅ GET    /projects/8 (token A, intacto)  → 200
  ✅ GET    /tasks/8 (token A, intacto)  → 200
  ✅ GET    /subtasks/8 (token A, intacto)  → 200
  ✅ GET    /board-columns/8 (token A, intacto)  → 200
  ✅ GET    /tags/8 (token A, intacto)  → 200
  ✅ GET    /invoices/8 (token A, intacto)  → 200
  ✅ GET    /expenses/7 (token A, intacto)  → 200
  ✅ GET    /notes/7 (token A, intacto)  → 200
  ✅ GET    /forms/7 (token A, intacto)  → 200
  ✅ GET    /document-templates/6 (token A, intacto)  → 200
  ✅ GET    /sops/5 (token A, intacto)  → 200
  ✅ GET    /portal-admin/clients/8/settings (token A, intacto)  → 200
  ✅ GET    /task-comments/task/8 (token A, comentario intacto)  → 200
  ✅ La tarea de B no quedó etiquetada con la etiqueta de A  → 200

🧹 Datos de prueba eliminados

======================================================================
✅ Resultado: 173/173 comprobaciones OK, 0 fallidas
======================================================================
```

## 13. Pendientes y recomendaciones (fuera del alcance de esta etapa)

- **Frontend (hecho, 1 línea):** `frontend/src/hooks/useCollaboration.js` ahora envía `token` en `join-note`; sin él la colaboración en notas responde `No autenticado` (antes era acceso sin autenticación).
- **Variables de entorno en producción:** definir `PDF_LINK_SECRET` (≥32 bytes aleatorios) en Railway. Si no existía, los enlaces de PDF ya enviados dejan de funcionar (deseable: estaban firmados con un secreto público del repo).
- **Tokens cortos enumerables en teoría** (~2^40): `dashboard_share_tokens.token` y los códigos de invitación del portal (`client_access_tokens`, `token_type='invite'`, formato `XXXX-XXXX`). No se cambió el formato que ve el usuario; recomendable subir a ≥12 caracteres o añadir rate limit en `/api/dashboard-share/public/:token` y `/api/portal/auth/login`.
- **CRM:** las etapas globales (`crm_pipeline_stages.organization_id IS NULL`) ahora son de solo lectura (403 al editar/borrar). Alternativa de producto: sembrar etapas propias por organización en `/register`.
- **Integraciones single-tenant por diseño:** WhatsApp/Kapso (`KAPSO_ORGANIZATION_ID`), datos bancarios/remitente/CC de LA REAL hardcodeados en `collections.js`/`scheduledReminders.js`/`payroll.js`, y `crm.js /proposals/deploy` publica en el GitHub `juanfelareal`. Deben salir de `organizations.settings` antes de vender.
- **Sockets:** el namespace `/agents` (Agent SDK con herramientas de filesystem) no autentica al usuario; `chatService.resolveSocketSession(token)` ya existe y puede reutilizarse.
- **Endpoints de migración** `POST /api/ugc/sync-assignments` y `/migrate-statuses` (ya limitados a la org): exigir `requireAdmin` o eliminarlos.
- **Permisos (no tenant):** en `team.js` cualquier miembro puede cambiar rol/permisos de otro; en `tasks.js`, `projectTemplates.js` y `task-views.js` hay rutas `PUT /reorder` / `PUT /bulk-visibility` inalcanzables por el orden de declaración; `portal/structured-briefs.js` consulta una tabla inexistente; varios INSERT de `ugc.js` leen `result.lastID` en vez de `lastInsertRowid`; `payroll.js /upload` referencia `text` sin definir en la rama XLSX.
- **Datos existentes:** tras desplegar, revisar el log de arranque: con más de una organización, las filas huérfanas (`organization_id NULL`) ya no se asignan automáticamente y se listan como `⚠️ <tabla>: N filas sin organization_id`.

## 14. Archivos tocados

70 archivos (`git diff --stat`): `backend/src/config/database.js`, `backend/src/migrations/001-multi-tenancy.js`, `backend/src/middleware/{teamAuth,clientAuth}.js`, 52 archivos de `backend/src/routes/**`, 10 de `backend/src/services/*`, `backend/src/utils/{tenant (nuevo), blobStorage, notificationHelper, recurringInvoices}.js`, `backend/scripts/test-tenant-isolation.mjs` (nuevo), `frontend/src/hooks/useCollaboration.js` (1 línea). Todos pasan `node --check`.
