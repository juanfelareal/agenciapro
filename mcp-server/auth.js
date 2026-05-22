/**
 * auth.js — Autenticación OAuth 2.1 del MCP remoto de AgenciaPro
 * -----------------------------------------------------------------------------
 * Implementa el proveedor OAuth que exige Claude para los conectores remotos.
 * Cuando un usuario conecta el conector:
 *   1. Claude lo manda a /authorize → se muestra la página de login.
 *   2. El usuario entra con SU correo y PIN de AgenciaPro.
 *   3. Se valida contra AgenciaPro y se emite un access token (JWT).
 *   4. Dentro del JWT viaja el token de AgenciaPro, CIFRADO (AES-256-GCM).
 *
 * Así cada llamada del MCP usa el token del usuario real → AgenciaPro aplica
 * sus permisos. El servidor no guarda base de datos: el estado es mínimo y
 * en memoria (códigos de autorización de corta vida y clientes registrados).
 * -----------------------------------------------------------------------------
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { login as agenciaproLogin } from "./server-core.js";

const SECRET = process.env.MCP_SECRET || "dev-insecure-secret-cambia-esto";
if (SECRET === "dev-insecure-secret-cambia-esto") {
  console.error(
    "[agenciapro-mcp] AVISO: MCP_SECRET no configurado. Usa un secreto real en producción."
  );
}
const ENC_KEY = crypto.createHash("sha256").update(SECRET).digest(); // 32 bytes

const ACCESS_TTL = 7 * 24 * 3600; // access token: 7 días (segundos)
const REFRESH_TTL = 90 * 24 * 3600; // refresh token: 90 días (segundos)
const CODE_TTL = 10 * 60 * 1000; // código de autorización: 10 min (ms)

// --- Cifrado del token de AgenciaPro (para que no viaje legible en el JWT) ---
function encryptAP(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}
function decryptAP(blob) {
  const buf = Buffer.from(blob, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// --- Estado en memoria (servidor de instancia única) ---
const clients = new Map(); // client_id -> info del cliente registrado
const codes = new Map(); // code -> { codeChallenge, apToken, sub, name, org, redirectUri, exp }

function cleanupCodes() {
  const now = Date.now();
  for (const [k, v] of codes) if (v.exp < now) codes.delete(k);
}

/** Emite un par de tokens (access + refresh) a partir de los datos de sesión. */
function issueTokens(d) {
  const apt = encryptAP(d.apToken);
  const base = { sub: d.sub, name: d.name, org: d.org, apt };
  return {
    access_token: jwt.sign(base, SECRET, { expiresIn: ACCESS_TTL }),
    token_type: "bearer",
    expires_in: ACCESS_TTL,
    refresh_token: jwt.sign({ ...base, typ: "refresh" }, SECRET, {
      expiresIn: REFRESH_TTL,
    }),
    scope: "agenciapro",
  };
}

// --- Página de login que ve el usuario ---
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function loginPage({ params, error }) {
  const p = params || {};
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Conectar AgenciaPro</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    background:#0D1B2A; color:#1a1a1a; display:flex; min-height:100vh; align-items:center; justify-content:center; }
  .card { background:#fff; border-radius:16px; padding:40px; width:100%; max-width:380px;
    box-shadow:0 20px 60px rgba(0,0,0,.35); }
  h1 { font-size:22px; margin:0 0 4px; font-weight:800; letter-spacing:-.5px; }
  .sub { color:#666; font-size:14px; margin:0 0 24px; }
  label { display:block; font-size:13px; font-weight:600; margin:14px 0 6px; }
  input { width:100%; padding:11px 13px; border:1px solid #d4d4d4; border-radius:9px; font-size:15px; }
  input:focus { outline:none; border-color:#16a34a; }
  button { width:100%; margin-top:22px; padding:12px; border:0; border-radius:9px;
    background:#16a34a; color:#fff; font-size:15px; font-weight:700; cursor:pointer; }
  button:hover { background:#15803d; }
  .err { background:#fee2e2; color:#b91c1c; font-size:13px; padding:9px 12px; border-radius:8px; margin-bottom:16px; }
  .foot { color:#999; font-size:12px; margin-top:18px; text-align:center; }
</style>
</head>
<body>
  <form class="card" method="POST" action="/login">
    <h1>Conectar con AgenciaPro</h1>
    <p class="sub">Entra con tu cuenta para que Claude pueda trabajar con la app en tu nombre.</p>
    ${error ? `<div class="err">${esc(error)}</div>` : ""}
    <label for="email">Correo</label>
    <input id="email" name="email" type="email" required autofocus autocomplete="username" />
    <label for="pin">PIN</label>
    <input id="pin" name="pin" type="password" required autocomplete="current-password" />
    <input type="hidden" name="client_id" value="${esc(p.client_id)}" />
    <input type="hidden" name="redirect_uri" value="${esc(p.redirect_uri)}" />
    <input type="hidden" name="code_challenge" value="${esc(p.code_challenge)}" />
    <input type="hidden" name="state" value="${esc(p.state)}" />
    <input type="hidden" name="resource" value="${esc(p.resource)}" />
    <button type="submit">Conectar</button>
    <p class="foot">Tus credenciales solo se usan para autenticarte en AgenciaPro.</p>
  </form>
</body>
</html>`;
}

// --- Proveedor OAuth que consume el SDK de MCP ---
export const authProvider = {
  clientsStore: {
    async getClient(id) {
      return clients.get(id);
    },
    async registerClient(client) {
      if (!client.client_id) client.client_id = crypto.randomUUID();
      clients.set(client.client_id, client);
      return client;
    },
  },

  /** GET /authorize → muestra la página de login. */
  async authorize(client, params, res) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(
      loginPage({
        params: {
          client_id: client.client_id,
          redirect_uri: params.redirectUri,
          code_challenge: params.codeChallenge,
          state: params.state || "",
          resource: params.resource ? params.resource.href : "",
        },
      })
    );
  },

  /** El SDK valida PKCE comparando el code_verifier con este challenge. */
  async challengeForAuthorizationCode(_client, code) {
    const d = codes.get(code);
    if (!d) throw new Error("Código de autorización inválido");
    return d.codeChallenge;
  },

  /** POST /token (grant authorization_code) → emite los tokens. */
  async exchangeAuthorizationCode(_client, code) {
    cleanupCodes();
    const d = codes.get(code);
    if (!d || d.exp < Date.now())
      throw new Error("Código de autorización inválido o expirado");
    codes.delete(code); // un solo uso
    return issueTokens(d);
  },

  /** POST /token (grant refresh_token) → emite tokens nuevos. */
  async exchangeRefreshToken(_client, refreshToken) {
    let p;
    try {
      p = jwt.verify(refreshToken, SECRET);
    } catch {
      throw new Error("refresh_token inválido o expirado");
    }
    if (p.typ !== "refresh") throw new Error("El token no es un refresh_token");
    return issueTokens({
      apToken: decryptAP(p.apt),
      sub: p.sub,
      name: p.name,
      org: p.org,
    });
  },

  /** Valida el access token en cada petición a /mcp. */
  async verifyAccessToken(token) {
    let p;
    try {
      p = jwt.verify(token, SECRET);
    } catch {
      throw new InvalidTokenError("Access token inválido o expirado");
    }
    if (p.typ === "refresh")
      throw new InvalidTokenError("Se recibió un refresh_token, no un access token");
    return {
      token,
      clientId: p.cid || "claude",
      scopes: ["agenciapro"],
      expiresAt: p.exp, // segundos
      extra: {
        agenciaproToken: decryptAP(p.apt),
        user: p.sub,
        name: p.name,
        org: p.org,
      },
    };
  },
};

/**
 * Handler de POST /login — recibe el formulario, valida contra AgenciaPro
 * y, si todo va bien, crea un código de autorización y redirige a Claude.
 */
export async function handleLogin(req, res) {
  const { email, pin, client_id, redirect_uri, code_challenge, state, resource } =
    req.body || {};

  const renderError = (msg, status = 400) =>
    res
      .status(status)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(loginPage({ params: req.body, error: msg }));

  // Validar la solicitud OAuth.
  const client = clients.get(client_id);
  if (!client || !code_challenge) {
    return renderError("Solicitud inválida. Vuelve a iniciar la conexión desde Claude.");
  }
  if (!client.redirect_uris || !client.redirect_uris.includes(redirect_uri)) {
    return renderError("redirect_uri no autorizado.");
  }

  // Autenticar contra AgenciaPro.
  let data;
  try {
    data = await agenciaproLogin(email, pin);
  } catch {
    return renderError("Correo o PIN incorrectos. Inténtalo de nuevo.", 401);
  }

  // Crear el código de autorización (un solo uso, 10 min).
  const code = crypto.randomBytes(24).toString("base64url");
  codes.set(code, {
    codeChallenge: code_challenge,
    apToken: data.token,
    sub: data.user?.email || email,
    name: data.user?.name || email,
    org: data.current_org?.name || "",
    redirectUri: redirect_uri,
    exp: Date.now() + CODE_TTL,
  });

  // Redirigir de vuelta a Claude con el código.
  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  res.redirect(302, url.href);
}
