// [email] Invitaciones al equipo por enlace (token de 7 días, un solo uso).
// Se monta dentro de /api/team (ver team.js).
//
//   POST /api/team/:id/invite                  (admin)   → genera token y envía `team-invite`
//   GET  /api/team/invitations/:token          (público) → valida y describe la invitación
//   POST /api/team/invitations/:token/accept   (público) → { pin } define el PIN y marca usada

import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { teamAuthMiddleware, requireAdmin } from '../middleware/teamAuth.js';
import { sendTemplate, APP_URL } from '../services/email.js';

const router = express.Router();

const INVITE_TTL_DAYS = 7;

/**
 * Crea (o renueva) la invitación de un miembro y envía el correo.
 * Reutilizable desde team.js al crear un miembro sin PIN con send_email.
 */
export const createTeamInviteAndSend = async ({ memberId, orgId, invitedById, invitedByName }) => {
  const member = await db.get(
    'SELECT id, name, email, user_id, organization_id FROM team_members WHERE id = ? AND organization_id = ?',
    [memberId, orgId]
  );
  if (!member) throw new Error('Miembro no encontrado');
  if (!member.email) throw new Error('El miembro no tiene correo');

  // Invalida invitaciones anteriores sin usar
  await db.run('UPDATE team_invites SET used_at = CURRENT_TIMESTAMP WHERE team_member_id = ? AND used_at IS NULL', [member.id]);

  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000);
  await db.run(
    'INSERT INTO team_invites (token, team_member_id, organization_id, invited_by, expires_at) VALUES (?, ?, ?, ?, ?)',
    [token, member.id, orgId, invitedById || null, expiresAt.toISOString()]
  );

  const inviteUrl = `${APP_URL()}/invitacion/${token}`;
  const result = await sendTemplate({
    orgId,
    to: member.email,
    template: 'team-invite',
    data: {
      memberName: member.name,
      email: member.email,
      inviteUrl,
      invitedBy: invitedByName || null,
      expiresInDays: INVITE_TTL_DAYS,
    },
  });

  return { token, inviteUrl, expiresAt, email: result };
};

router.post('/:id/invite', teamAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const out = await createTeamInviteAndSend({
      memberId: req.params.id,
      orgId: req.orgId,
      invitedById: req.teamMember?.id,
      invitedByName: req.teamMember?.name,
    });
    res.json({
      success: true,
      invite_url: out.inviteUrl,
      expires_at: out.expiresAt.toISOString(),
      email: out.email,
      message: out.email?.ok
        ? (out.email.provider === 'log' ? 'Invitación generada (sin proveedor de correo: revisa la consola del servidor).' : 'Invitación enviada por correo.')
        : 'Invitación generada, pero el correo falló. Comparte el enlace manualmente.',
    });
  } catch (error) {
    const status = /no encontrado|no tiene correo/i.test(error.message) ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

const loadInvite = async (token) => {
  const inv = await db.get(
    `SELECT ti.*, tm.name AS member_name, tm.email AS member_email, tm.user_id, tm.status AS member_status,
            o.name AS org_name, o.logo_url AS org_logo
     FROM team_invites ti
     JOIN team_members tm ON tm.id = ti.team_member_id
     LEFT JOIN organizations o ON o.id = ti.organization_id
     WHERE ti.token = ?`,
    [token]
  );
  if (!inv) return { error: 'Invitación no encontrada', status: 404 };
  if (inv.used_at) return { error: 'Esta invitación ya fue usada', status: 410 };
  if (new Date(inv.expires_at).getTime() < Date.now()) return { error: 'Esta invitación venció. Pide que te la reenvíen.', status: 410 };
  return { inv };
};

router.get('/invitations/:token', async (req, res) => {
  try {
    const { inv, error, status } = await loadInvite(req.params.token);
    if (error) return res.status(status).json({ error });
    const user = inv.user_id ? await db.get('SELECT pin_hash FROM users WHERE id = ?', [inv.user_id]) : null;
    res.json({
      valid: true,
      member_name: inv.member_name,
      email: inv.member_email,
      org_name: inv.org_name,
      org_logo: inv.org_logo,
      has_pin: Boolean(user?.pin_hash),
      expires_at: inv.expires_at,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/invitations/:token/accept', async (req, res) => {
  try {
    const { inv, error, status } = await loadInvite(req.params.token);
    if (error) return res.status(status).json({ error });

    const email = inv.member_email.toLowerCase().trim();
    let userId = inv.user_id;
    if (!userId) {
      const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existing) userId = existing.id;
      else {
        const created = await db.run('INSERT INTO users (email, name) VALUES (?, ?) RETURNING id', [email, inv.member_name]);
        userId = created.lastInsertRowid;
      }
      await db.run('UPDATE team_members SET user_id = ? WHERE id = ?', [userId, inv.team_member_id]);
    }

    const user = await db.get('SELECT id, pin_hash FROM users WHERE id = ?', [userId]);
    const pin = String(req.body?.pin ?? '');

    if (user?.pin_hash && !pin) {
      // Ya tenía cuenta en Orbit (otra organización): no tocamos su PIN.
      await db.run('UPDATE team_invites SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [inv.id]);
      await db.run(`UPDATE team_members SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'active'`, [inv.team_member_id]);
      return res.json({ success: true, email, has_pin: true, message: 'Ya tienes cuenta en Orbit. Entra con tu PIN actual.' });
    }

    if (pin.length < 4) return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });

    const pinHash = await bcrypt.hash(pin, 10);
    await db.run('UPDATE users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pinHash, userId]);
    await db.run('UPDATE team_members SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [pinHash, userId]);
    await db.run(`UPDATE team_members SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'active'`, [inv.team_member_id]);
    await db.run('UPDATE team_invites SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [inv.id]);

    res.json({ success: true, email, has_pin: false, message: 'PIN definido. Ya puedes entrar.' });
  } catch (error) {
    console.error('accept invite error:', error);
    res.status(500).json({ error: 'No se pudo aceptar la invitación' });
  }
});

export default router;
