/**
 * Freno a fuerza bruta para los inicios de sesión con PIN.
 *
 * El PIN de Orbit es corto (4–6 dígitos), así que sin un límite se puede adivinar por
 * intentos. Este middleware cuenta los intentos FALLIDOS por correo y por IP; al pasar
 * LOGIN_MAX_FAILS (6) en LOGIN_WINDOW_MIN (15) minutos responde 429 sin consultar la base.
 * Un login correcto limpia el contador. Estado en memoria (por instancia), suficiente para
 * un backend de una sola réplica; si se escala, mover a Postgres/Redis.
 *
 * Uso en una ruta de login (el handler debe llamar `req.loginThrottle.fail()` cuando las
 * credenciales no sirven y `req.loginThrottle.ok()` cuando sí):
 *   router.post('/login', loginThrottle(), async (req, res) => { ... });
 */
const MAX_FAILS = Number(process.env.LOGIN_MAX_FAILS || 6);
const WINDOW_MS = Number(process.env.LOGIN_WINDOW_MIN || 15) * 60 * 1000;
const fails = new Map(); // clave → { count, until }

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of fails) if (now > v.until) fails.delete(k);
}, 5 * 60 * 1000).unref();

export const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

export function loginThrottle({ emailField = 'email' } = {}) {
  return (req, res, next) => {
    const email = String(req.body?.[emailField] || '').trim().toLowerCase();
    const keys = [email ? `email:${email}` : null, `ip:${clientIp(req)}`].filter(Boolean);
    for (const k of keys) {
      const f = fails.get(k);
      if (f && f.count >= MAX_FAILS && Date.now() < f.until) {
        const minutes = Math.ceil((f.until - Date.now()) / 60000);
        res.set('Retry-After', String(minutes * 60));
        return res.status(429).json({ error: `Demasiados intentos. Espera ${minutes} min e inténtalo de nuevo.`, retry_after_minutes: minutes });
      }
    }
    req.loginThrottle = {
      fail: () => {
        for (const k of keys) {
          const f = fails.get(k);
          const count = f && Date.now() < f.until ? f.count + 1 : 1;
          fails.set(k, { count, until: Date.now() + WINDOW_MS });
        }
      },
      ok: () => { for (const k of keys) fails.delete(k); },
    };
    next();
  };
}

/** Para pruebas: borra todos los contadores. */
export const resetLoginThrottle = () => fails.clear();
