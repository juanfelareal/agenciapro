/**
 * Migración 2026-06-10: cambio de correos personales → corporativos @larealmarketing.com
 *
 * Actualiza users.email y team_members.email en una sola transacción, manteniendo
 * los IDs intactos (tareas, proyectos, comisiones, etc. no se ven afectados).
 *
 * Idempotente: cada UPDATE está condicionado al email viejo, correr dos veces no hace nada.
 *
 * Uso:
 *   DB_URL="postgresql://..." node scripts/migrate-corporate-emails.js          # dry-run
 *   DB_URL="postgresql://..." node scripts/migrate-corporate-emails.js --apply  # aplica
 */
const path = require('path');
const { Pool } = require(path.join(__dirname, '..', 'node_modules', 'pg'));

const MAPPING = [
  { userId: 1,  name: 'Juan Felipe León León', oldEmail: 'juanfelipeleonleon@gmail.com', newEmail: 'juanfe@larealmarketing.com' },
  { userId: 2,  name: 'Juan David Gallego',    oldEmail: 'juandagos@gmail.com',          newEmail: 'juanda@larealmarketing.com' },
  { userId: 4,  name: 'Laura Martínez',        oldEmail: 'laumtnz0312@gmail.com',        newEmail: 'lau@larealmarketing.com' },
  { userId: 5,  name: 'Santiago Upegui',       oldEmail: 'upeguis11@gmail.com',          newEmail: 'santi@larealmarketing.com' },
  { userId: 6,  name: 'Nicolás Agudelo',       oldEmail: 'nicolasagudelo111@gmail.com',  newEmail: 'nico@larealmarketing.com' },
  { userId: 15, name: 'Jose Roa',              oldEmail: 'misteriodesignscm@gmail.com',  newEmail: 'roa@larealmarketing.com' },
];

const apply = process.argv.includes('--apply');

async function main() {
  if (!process.env.DB_URL) {
    console.error('Falta DB_URL en el entorno');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DB_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    // Pre-check: ningún correo nuevo puede estar ya ocupado por OTRO usuario
    for (const m of MAPPING) {
      const taken = await client.query(
        'SELECT id, email FROM users WHERE email = $1 AND id <> $2',
        [m.newEmail, m.userId]
      );
      if (taken.rows.length > 0) {
        throw new Error(`${m.newEmail} ya pertenece al user id ${taken.rows[0].id} — abortando`);
      }
    }

    await client.query('BEGIN');

    for (const m of MAPPING) {
      const u = await client.query(
        `UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND email = $3`,
        [m.newEmail, m.userId, m.oldEmail]
      );
      const tm = await client.query(
        `UPDATE team_members SET email = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND email = $3`,
        [m.newEmail, m.userId, m.oldEmail]
      );
      const status = u.rowCount === 0 && tm.rowCount === 0 ? 'sin cambios (¿ya migrado?)' : `users=${u.rowCount}, team_members=${tm.rowCount}`;
      console.log(`${m.name}: ${m.oldEmail} → ${m.newEmail} [${status}]`);
    }

    if (apply) {
      await client.query('COMMIT');
      console.log('\n✅ COMMIT aplicado');
    } else {
      await client.query('ROLLBACK');
      console.log('\n🔍 DRY-RUN: rollback ejecutado, nada cambió. Corre con --apply para aplicar.');
    }

    // Verificación final
    const check = await client.query(
      `SELECT u.id, u.email AS users_email, tm.email AS tm_email, tm.name
       FROM users u JOIN team_members tm ON tm.user_id = u.id
       WHERE u.id = ANY($1) ORDER BY u.id`,
      [MAPPING.map(m => m.userId)]
    );
    console.table(check.rows);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error, rollback:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
