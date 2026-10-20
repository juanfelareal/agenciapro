// [email] Tablas del sistema de correos transaccionales.
// Se invoca desde initializeDatabase() en database.js. Todo es idempotente.
export const ensureEmailTables = async (pool) => {
  // Registro de cada correo enviado (o intentado) por organización
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
      "to" TEXT NOT NULL,
      subject TEXT,
      template TEXT,
      status TEXT DEFAULT 'queued',
      provider TEXT,
      provider_id TEXT,
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_log_org ON email_log(organization_id, created_at DESC)`);

  // Códigos de 6 dígitos para recuperar el PIN (15 min)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pin_reset_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pin_reset_codes_email ON pin_reset_codes(email)`);

  // Invitaciones al equipo por enlace (7 días)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_invites (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      team_member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      invited_by INTEGER,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_invites_member ON team_invites(team_member_id)`);
};
