/**
 * Migration 001: Multi-Tenancy
 *
 * Converts AgenciaPro from single-tenant to multi-tenant SaaS.
 *
 * New tables: users, organizations, user_session_tokens
 * Adds organization_id to 20 root tables
 * Migrates existing data as org #1 "LA REAL"
 * Updates UNIQUE constraints to composite (name + organization_id)
 *
 * Run: node --experimental-modules src/migrations/001-multi-tenancy.js
 */

import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;

const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🚀 Starting multi-tenancy migration...\n');

    // =============================================
    // STEP 1: Create new tables
    // =============================================
    console.log('📦 Step 1: Creating new tables...');

    // Users table (global identity: email + PIN)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        pin_hash TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ users table created');

    // Organizations table (tenant)
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        logo_url TEXT,
        plan TEXT DEFAULT 'free',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ organizations table created');

    // User session tokens (replaces team_session_tokens)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_session_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        current_org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        status TEXT CHECK(status IN ('active', 'expired', 'revoked')) DEFAULT 'active',
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ user_session_tokens table created');

    // Indexes for new tables
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_session_tokens_token ON user_session_tokens(token)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_session_tokens_user ON user_session_tokens(user_id)`);
    console.log('  ✅ Indexes created\n');

    // =============================================
    // STEP 2: Add columns to team_members
    // =============================================
    console.log('📦 Step 2: Adding user_id and organization_id to team_members...');

    // Add user_id column
    const hasUserId = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'team_members' AND column_name = 'user_id'
    `);
    if (hasUserId.rows.length === 0) {
      await client.query(`ALTER TABLE team_members ADD COLUMN user_id INTEGER REFERENCES users(id)`);
      console.log('  ✅ user_id added to team_members');
    }

    // Add organization_id column
    const hasOrgId = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'team_members' AND column_name = 'organization_id'
    `);
    if (hasOrgId.rows.length === 0) {
      await client.query(`ALTER TABLE team_members ADD COLUMN organization_id INTEGER REFERENCES organizations(id)`);
      console.log('  ✅ organization_id added to team_members');
    }
    console.log('');

    // =============================================
    // STEP 3: Add organization_id to 20 root tables
    // =============================================
    console.log('📦 Step 3: Adding organization_id to root tables...');

    const rootTables = [
      'clients',
      'projects',
      'invoices',
      'expenses',
      'commissions',
      'tags',
      'note_categories',
      'note_folders',
      'notes',
      'sop_categories',
      'sops',
      'project_templates',
      'automations',
      'notifications',
      'activity_log',
      'siigo_settings',
      'siigo_document_types',
      'siigo_payment_types',
      'siigo_taxes',
      'time_entries'
    ];

    for (const table of rootTables) {
      const hasCol = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'organization_id'
      `, [table]);

      if (hasCol.rows.length === 0) {
        await client.query(`ALTER TABLE ${table} ADD COLUMN organization_id INTEGER REFERENCES organizations(id)`);
        console.log(`  ✅ organization_id added to ${table}`);
      } else {
        console.log(`  ⏭️  organization_id already exists in ${table}`);
      }
    }
    console.log('');

    // =============================================
    // STEP 4: Migrate existing data
    // =============================================
    console.log('📦 Step 4: Migrating existing data...');

    // 4a. Create org #1 "LA REAL"
    const existingOrg = await client.query(`SELECT id FROM organizations WHERE slug = 'la-real'`);
    let orgId;
    if (existingOrg.rows.length === 0) {
      const orgResult = await client.query(`
        INSERT INTO organizations (name, slug, plan, settings)
        VALUES ('LA REAL', 'la-real', 'free', '{}')
        RETURNING id
      `);
      orgId = orgResult.rows[0].id;
      console.log(`  ✅ Organization "LA REAL" created with id=${orgId}`);
    } else {
      orgId = existingOrg.rows[0].id;
      console.log(`  ⏭️  Organization "LA REAL" already exists with id=${orgId}`);
    }

    // 4b. Create users from team_members (copy pin_hash)
    const teamMembers = await client.query(`
      SELECT id, name, email, pin_hash FROM team_members WHERE user_id IS NULL
    `);

    for (const member of teamMembers.rows) {
      // Check if user with this email already exists
      const existingUser = await client.query(`SELECT id FROM users WHERE email = $1`, [member.email]);
      let userId;

      if (existingUser.rows.length === 0) {
        const userResult = await client.query(`
          INSERT INTO users (email, name, pin_hash)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [member.email, member.name, member.pin_hash]);
        userId = userResult.rows[0].id;
        console.log(`  ✅ User created: ${member.email} (user_id=${userId})`);
      } else {
        userId = existingUser.rows[0].id;
        console.log(`  ⏭️  User already exists: ${member.email} (user_id=${userId})`);
      }

      // Link team_member to user and org
      await client.query(`
        UPDATE team_members SET user_id = $1, organization_id = $2 WHERE id = $3
      `, [userId, orgId, member.id]);
    }

    // 4c. Set organization_id = orgId on all root tables
    for (const table of rootTables) {
      const result = await client.query(`
        UPDATE ${table} SET organization_id = $1 WHERE organization_id IS NULL
      `, [orgId]);
      if (result.rowCount > 0) {
        console.log(`  ✅ ${table}: ${result.rowCount} rows updated with org_id=${orgId}`);
      }
    }

    // 4d. Copy team_session_tokens → user_session_tokens
    const existingSessions = await client.query(`
      SELECT tst.*, tm.user_id
      FROM team_session_tokens tst
      JOIN team_members tm ON tst.team_member_id = tm.id
      WHERE tst.status = 'active' AND tm.user_id IS NOT NULL
    `);

    for (const session of existingSessions.rows) {
      const existingToken = await client.query(
        `SELECT 1 FROM user_session_tokens WHERE token = $1`, [session.token]
      );
      if (existingToken.rows.length === 0) {
        await client.query(`
          INSERT INTO user_session_tokens (user_id, current_org_id, token, status, expires_at, last_used_at, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [session.user_id, orgId, session.token, session.status, session.expires_at, session.last_used_at, session.created_at]);
      }
    }
    console.log(`  ✅ ${existingSessions.rows.length} session tokens migrated`);
    console.log('');

    // =============================================
    // STEP 5: Create indexes on organization_id
    // =============================================
    console.log('📦 Step 5: Creating organization_id indexes...');

    for (const table of rootTables) {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_${table}_org_id ON ${table}(organization_id)`);
    }
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_org_id ON team_members(organization_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)`);
    console.log('  ✅ All organization_id indexes created\n');

    // =============================================
    // STEP 6: Update UNIQUE constraints to composites
    // =============================================
    console.log('📦 Step 6: Updating UNIQUE constraints to composites...');

    // tags.name → (name, organization_id)
    try {
      await client.query(`ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_org ON tags(name, organization_id)`);
      console.log('  ✅ tags: UNIQUE(name) → UNIQUE(name, organization_id)');
    } catch (e) {
      console.log('  ⚠️  tags constraint update:', e.message);
    }

    // note_categories.name → (name, organization_id)
    try {
      await client.query(`ALTER TABLE note_categories DROP CONSTRAINT IF EXISTS note_categories_name_key`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_note_categories_name_org ON note_categories(name, organization_id)`);
      console.log('  ✅ note_categories: UNIQUE(name) → UNIQUE(name, organization_id)');
    } catch (e) {
      console.log('  ⚠️  note_categories constraint update:', e.message);
    }

    // sop_categories.name → (name, organization_id)
    try {
      await client.query(`ALTER TABLE sop_categories DROP CONSTRAINT IF EXISTS sop_categories_name_key`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sop_categories_name_org ON sop_categories(name, organization_id)`);
      console.log('  ✅ sop_categories: UNIQUE(name) → UNIQUE(name, organization_id)');
    } catch (e) {
      console.log('  ⚠️  sop_categories constraint update:', e.message);
    }

    // invoices.invoice_number → (invoice_number, organization_id)
    try {
      await client.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_org ON invoices(invoice_number, organization_id)`);
      console.log('  ✅ invoices: UNIQUE(invoice_number) → UNIQUE(invoice_number, organization_id)');
    } catch (e) {
      console.log('  ⚠️  invoices constraint update:', e.message);
    }

    // team_members.email → (user_id, organization_id) — one membership per user per org
    // Keep the old email UNIQUE for now (will be handled by users table)
    // But add composite unique for membership
    try {
      await client.query(`ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_email_key`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_user_org ON team_members(user_id, organization_id)`);
      console.log('  ✅ team_members: UNIQUE(email) → UNIQUE(user_id, organization_id)');
    } catch (e) {
      console.log('  ⚠️  team_members constraint update:', e.message);
    }

    console.log('');

    // =============================================
    // STEP 7: Commit
    // =============================================
    await client.query('COMMIT');
    console.log('🎉 Multi-tenancy migration completed successfully!');
    console.log('');
    console.log('Summary:');
    console.log('  - 3 new tables: users, organizations, user_session_tokens');
    console.log(`  - Organization "LA REAL" created (id=${orgId})`);
    console.log(`  - ${teamMembers.rows.length} users created from team_members`);
    console.log(`  - ${rootTables.length} tables updated with organization_id`);
    console.log('  - UNIQUE constraints updated to composites');
    console.log('  - Session tokens migrated');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Deploy auth refactor (Phase 2)');
    console.log('  2. Deploy route scoping (Phase 3)');
    console.log('  3. Deploy frontend changes (Phase 4)');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    console.error('  All changes have been rolled back.');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Export for use from server.js
export { migrate };

// Auto-run when executed directly
const isDirectRun = process.argv[1]?.includes('001-multi-tenancy');
if (isDirectRun) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
