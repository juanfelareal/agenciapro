// [email] Recuperación de PIN por código de 6 dígitos.
// Se monta dentro de /api/auth (ver auth.js). Público: no requiere sesión.
//
//   POST /api/auth/forgot-pin { email }                 → siempre 200
//   POST /api/auth/reset-pin  { email, code, new_pin }  → valida y cambia el PIN
//
// Si /reset-pin llega sin `code`, hace next() y cae en el handler legado de auth.js
// (que enviaba un PIN nuevo directo), así nada existente se rompe.

import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { sendTemplate, APP_URL } from '../services/email.js';

const router = express.Router();

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');
const generateCode = () => crypto.randomInt(0, 1000000).toString().padStart(6, '0');

// Correos del usuario → primera organización donde es miembro (para la marca del correo).
const orgForUser = async (userId) => {
  const row = await db.get(
    `SELECT organization_id FROM team_members WHERE user_id = ? AND organization_id IS NOT NULL
     ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id ASC LIMIT 1`,
    [userId]
  );
  return row?.organization_id || null;
};

router.post('/forgot-pin', async (req, res) => {
  const generic = { success: true, message: 'Si el correo existe, te enviamos un código de 6 dígitos.' };
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email es requerido' });

    const user = await db.get('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (!user) return res.json(generic);

    // Un solo código activo por correo
    await db.run('UPDATE pin_reset_codes SET used_at = CURRENT_TIMESTAMP WHERE email = ? AND used_at IS NULL', [email]);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
    await db.run(
      'INSERT INTO pin_reset_codes (user_id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)',
      [user.id, email, hashCode(code), expiresAt.toISOString()]
    );

    const orgId = await orgForUser(user.id);
    sendTemplate({
      orgId,
      to: email,
      template: 'pin-reset',
      data: {
        userName: user.name,
        code,
        expiresInMinutes: CODE_TTL_MINUTES,
        resetUrl: `${APP_URL()}/recuperar-pin?email=${encodeURIComponent(email)}`,
      },
    }).catch((e) => console.error('[forgot-pin] email error:', e.message));

    return res.json(generic);
  } catch (error) {
    console.error('forgot-pin error:', error);
    // No revelamos nada al cliente; el log interno ya tiene el detalle.
    return res.json(generic);
  }
});

router.post('/reset-pin', async (req, res, next) => {
  const { code } = req.body || {};
  if (!code) return next(); // flujo legado (auth.js)

  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const newPin = String(req.body?.new_pin ?? req.body?.newPin ?? '');
    const codeStr = String(code).replace(/\s+/g, '');

    if (!email || !codeStr) return res.status(400).json({ error: 'Email y código son requeridos' });
    if (!/^\d{6}$/.test(codeStr)) return res.status(400).json({ error: 'El código debe tener 6 dígitos' });
    if (newPin.length < 4) return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });

    const record = await db.get(
      `SELECT * FROM pin_reset_codes WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    const invalid = () => res.status(400).json({ error: 'Código inválido o vencido. Pide uno nuevo.' });
    if (!record) return invalid();
    if (new Date(record.expires_at).getTime() < Date.now()) return invalid();
    if (record.attempts >= MAX_ATTEMPTS) return invalid();

    if (record.code_hash !== hashCode(codeStr)) {
      await db.run('UPDATE pin_reset_codes SET attempts = attempts + 1 WHERE id = ?', [record.id]);
      return invalid();
    }

    const user = await db.get('SELECT id FROM users WHERE id = ?', [record.user_id]);
    if (!user) return invalid();

    const pinHash = await bcrypt.hash(newPin, 10);
    await db.run('UPDATE users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pinHash, user.id]);
    await db.run('UPDATE team_members SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [pinHash, user.id]);
    await db.run('UPDATE pin_reset_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);

    // Revocar sesiones anteriores (nuevas y legadas)
    await db.run(`UPDATE user_session_tokens SET status = 'revoked' WHERE user_id = ? AND status = 'active'`, [user.id]);
    await db.run(
      `UPDATE team_session_tokens SET status = 'revoked'
       WHERE status = 'active' AND team_member_id IN (SELECT id FROM team_members WHERE user_id = ?)`,
      [user.id]
    ).catch(() => {});

    return res.json({ success: true, email, message: 'PIN actualizado. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('reset-pin (code) error:', error);
    return res.status(500).json({ error: 'No se pudo restablecer el PIN' });
  }
});

export default router;
