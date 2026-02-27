import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// Debug: Log environment info at startup
console.log('🔧 Database configuration:');
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set (hidden)' : '❌ NOT SET');

if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL environment variable is not set!');
  console.error('   Make sure PostgreSQL is linked in Railway and DATABASE_URL is available.');
}

// Use DATABASE_URL from Railway (PostgreSQL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test connection on pool creation
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});

// Helper to convert SQLite-style ? placeholders to PostgreSQL $1, $2, etc.
const convertPlaceholders = (sql) => {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
};

// Database wrapper with methods similar to better-sqlite3 but async
const db = {
  // Execute a query and return all rows
  async all(sql, params = []) {
    const convertedSql = convertPlaceholders(sql);
    const result = await pool.query(convertedSql, params);
    return result.rows;
  },

  // Execute a query and return the first row
  async get(sql, params = []) {
    const convertedSql = convertPlaceholders(sql);
    const result = await pool.query(convertedSql, params);
    return result.rows[0];
  },

  // Execute a query (INSERT, UPDATE, DELETE) and return info
  async run(sql, params = []) {
    let convertedSql = convertPlaceholders(sql);
    // PostgreSQL needs RETURNING id to get the inserted row's id
    if (sql.trim().toUpperCase().startsWith('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
      convertedSql += ' RETURNING id';
    }
    const result = await pool.query(convertedSql, params);
    return {
      changes: result.rowCount,
      lastInsertRowid: result.rows[0]?.id
    };
  },

  // Execute raw SQL (for table creation, etc.)
  async exec(sql) {
    await pool.query(sql);
  },

  // For compatibility - returns self with methods
  prepare(sql) {
    const convertedSql = convertPlaceholders(sql);
    // For INSERT queries, add RETURNING id to get the inserted row's id
    let runSql = convertedSql;
    if (sql.trim().toUpperCase().startsWith('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
      runSql = convertedSql + ' RETURNING id';
    }
    return {
      all: async (...params) => {
        const result = await pool.query(convertedSql, params);
        return result.rows;
      },
      get: async (...params) => {
        const result = await pool.query(convertedSql, params);
        return result.rows[0];
      },
      run: async (...params) => {
        const result = await pool.query(runSql, params);
        return {
          changes: result.rowCount,
          lastInsertRowid: result.rows[0]?.id
        };
      }
    };
  },

  // Direct query access
  query: (sql, params) => pool.query(sql, params),

  // Transaction support
  async transaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await callback(client);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};

// Initialize database schema
export const initializeDatabase = async () => {
  console.log('🔄 Starting database initialization...');

  // First test the connection
  try {
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Database connection test successful:', testResult.rows[0].now);
  } catch (connError) {
    console.error('❌ Database connection test FAILED:', connError.message);
    throw connError;
  }

  try {
    // Users table (must be created first - referenced by other tables)
    await pool.query(`
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

    // Organizations table (must be created early - referenced by many tables)
    await pool.query(`
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

    // Clients table (CRM)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        nit TEXT,
        status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
        contract_value REAL DEFAULT 0,
        contract_start_date TEXT,
        contract_end_date TEXT,
        notes TEXT,
        is_recurring INTEGER DEFAULT 0,
        billing_day INTEGER,
        recurring_amount REAL DEFAULT 0,
        siigo_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Team members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT CHECK(role IN ('admin', 'manager', 'member')) DEFAULT 'member',
        position TEXT,
        status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
        hire_date TEXT,
        birthday TEXT,
        permissions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        status TEXT CHECK(status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')) DEFAULT 'planning',
        budget REAL DEFAULT 0,
        spent REAL DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        assigned_to INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        status TEXT CHECK(status IN ('todo', 'in_progress', 'review', 'done')) DEFAULT 'todo',
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
        due_date TEXT,
        is_recurring INTEGER DEFAULT 0,
        recurrence_pattern TEXT,
        parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        timeline_start TEXT,
        timeline_end TEXT,
        progress INTEGER DEFAULT 0,
        color TEXT,
        estimated_hours REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Project team assignments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_team (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        role TEXT,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, team_member_id)
      )
    `);

    // Invoices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        amount REAL NOT NULL,
        status TEXT CHECK(status IN ('draft', 'approved', 'invoiced', 'paid')) DEFAULT 'draft',
        issue_date TEXT NOT NULL,
        due_date TEXT,
        paid_date TEXT,
        notes TEXT,
        invoice_type TEXT DEFAULT 'con_iva',
        payment_proof TEXT,
        is_recurring INTEGER DEFAULT 0,
        recurrence_frequency TEXT,
        recurrence_status TEXT DEFAULT 'draft',
        next_recurrence_date TEXT,
        siigo_id TEXT,
        siigo_status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Expenses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        category TEXT,
        amount REAL NOT NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        expense_date TEXT NOT NULL,
        payment_method TEXT,
        receipt_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Commissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS commissions (
        id SERIAL PRIMARY KEY,
        team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        otros TEXT,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        net_sales REAL NOT NULL,
        commission_amount REAL NOT NULL,
        status TEXT CHECK(status IN ('pending', 'approved', 'paid')) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Board columns
    await pool.query(`
      CREATE TABLE IF NOT EXISTS board_columns (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        column_name TEXT NOT NULL,
        column_type TEXT NOT NULL,
        column_order INTEGER DEFAULT 0,
        settings TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Board column values
    await pool.query(`
      CREATE TABLE IF NOT EXISTS board_column_values (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        column_id INTEGER NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(task_id, column_id)
      )
    `);

    // Task assignees (many-to-many for multi-assignment)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_assignees (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(task_id, team_member_id)
      )
    `);

    // Task dependencies
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        dependency_type TEXT CHECK(dependency_type IN ('FS', 'SS', 'FF', 'SF')) DEFAULT 'FS',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task comments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task files
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_files (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        file_type TEXT,
        uploaded_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Subtasks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_completed INTEGER DEFAULT 0,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tags
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#6366F1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task Tags
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_tags (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, tag_id)
      )
    `);

    // Invoice status history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoice_status_history (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        from_status TEXT,
        to_status TEXT NOT NULL,
        changed_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Activity log
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        user_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Automations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_conditions TEXT,
        action_type TEXT NOT NULL,
        action_params TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        type TEXT CHECK(type IN ('task_assigned', 'comment', 'mention', 'task_updated', 'task_due', 'task_completed', 'automation')) NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        related_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        is_read INTEGER DEFAULT 0,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TEXT
      )
    `);

    // Note Categories
    await pool.query(`
      CREATE TABLE IF NOT EXISTS note_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#6366F1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Note Folders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS note_folders (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES note_folders(id) ON DELETE CASCADE,
        icon TEXT DEFAULT '📁',
        color TEXT DEFAULT '#6366F1',
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        content_plain TEXT,
        color TEXT DEFAULT '#FFFFFF',
        category_id INTEGER REFERENCES note_categories(id) ON DELETE SET NULL,
        folder_id INTEGER REFERENCES note_folders(id) ON DELETE SET NULL,
        is_pinned INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Note Links
    await pool.query(`
      CREATE TABLE IF NOT EXISTS note_links (
        id SERIAL PRIMARY KEY,
        note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        team_member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add yjs_state column to notes for real-time collaboration (if not exists)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notes' AND column_name='yjs_state') THEN
          ALTER TABLE notes ADD COLUMN yjs_state TEXT;
        END IF;
      END $$;
    `);

    // Add visibility column to notes for private notes feature
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notes' AND column_name='visibility') THEN
          ALTER TABLE notes ADD COLUMN visibility TEXT CHECK(visibility IN ('organization', 'private')) DEFAULT 'organization';
        END IF;
      END $$;
    `);

    // Note share tokens (for public sharing)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS note_share_tokens (
        id SERIAL PRIMARY KEY,
        note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        status TEXT CHECK(status IN ('active', 'revoked')) DEFAULT 'active',
        allow_comments INTEGER DEFAULT 1,
        allow_edits INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES team_members(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        last_accessed_at TIMESTAMP,
        access_count INTEGER DEFAULT 0,
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Note comments (from clients via public link)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS note_comments (
        id SERIAL PRIMARY KEY,
        note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        share_token_id INTEGER REFERENCES note_share_tokens(id) ON DELETE SET NULL,
        parent_id INTEGER REFERENCES note_comments(id) ON DELETE CASCADE,
        author_name TEXT NOT NULL,
        author_type TEXT CHECK(author_type IN ('client', 'team')) DEFAULT 'client',
        content TEXT NOT NULL,
        selection_from INTEGER,
        selection_to INTEGER,
        quoted_text TEXT,
        is_resolved INTEGER DEFAULT 0,
        resolved_by INTEGER REFERENCES team_members(id),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Add parent_id column if it doesn't exist (for replies)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='note_comments' AND column_name='parent_id') THEN
          ALTER TABLE note_comments ADD COLUMN parent_id INTEGER REFERENCES note_comments(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Note client edits (edits from clients shown in red)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS note_client_edits (
        id SERIAL PRIMARY KEY,
        note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        share_token_id INTEGER NOT NULL REFERENCES note_share_tokens(id) ON DELETE CASCADE,
        author_name TEXT NOT NULL,
        content_json TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
        reviewed_by INTEGER REFERENCES team_members(id),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Facebook credentials
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_facebook_credentials (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        ad_account_id TEXT NOT NULL,
        ad_account_name TEXT,
        status TEXT CHECK(status IN ('active', 'inactive', 'expired', 'error')) DEFAULT 'active',
        last_sync_at TEXT,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(client_id, ad_account_id)
      )
    `);

    // Shopify credentials
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_shopify_credentials (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
        store_url TEXT NOT NULL,
        access_token TEXT NOT NULL,
        status TEXT CHECK(status IN ('active', 'inactive', 'error')) DEFAULT 'active',
        last_sync_at TEXT,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Daily metrics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_daily_metrics (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        metric_date TEXT NOT NULL,
        shopify_revenue REAL DEFAULT 0,
        shopify_orders INTEGER DEFAULT 0,
        shopify_aov REAL DEFAULT 0,
        shopify_refunds REAL DEFAULT 0,
        shopify_net_revenue REAL DEFAULT 0,
        fb_spend REAL DEFAULT 0,
        fb_impressions INTEGER DEFAULT 0,
        fb_clicks INTEGER DEFAULT 0,
        fb_ctr REAL DEFAULT 0,
        fb_cpc REAL DEFAULT 0,
        fb_conversions INTEGER DEFAULT 0,
        fb_revenue REAL DEFAULT 0,
        fb_roas REAL DEFAULT 0,
        total_revenue REAL DEFAULT 0,
        overall_roas REAL DEFAULT 0,
        cost_per_order REAL DEFAULT 0,
        ad_spend_percentage REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(client_id, metric_date)
      )
    `);

    // Metrics sync jobs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS metrics_sync_jobs (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        job_type TEXT CHECK(job_type IN ('facebook', 'shopify', 'all')) NOT NULL,
        status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
        started_at TEXT,
        completed_at TEXT,
        records_processed INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // SOP Categories
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sop_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        color TEXT DEFAULT '#6366F1',
        icon TEXT DEFAULT 'folder',
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // SOPs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sops (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE,
        description TEXT,
        content TEXT,
        steps TEXT,
        editor_mode TEXT CHECK(editor_mode IN ('freeform', 'steps')) DEFAULT 'freeform',
        category_id INTEGER REFERENCES sop_categories(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        status TEXT CHECK(status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
        version INTEGER DEFAULT 1,
        view_count INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_at TEXT
      )
    `);

    // SOP Revisions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sop_revisions (
        id SERIAL PRIMARY KEY,
        sop_id INTEGER NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
        content TEXT,
        version INTEGER NOT NULL,
        changed_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        change_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Siigo settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS siigo_settings (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        access_key TEXT NOT NULL,
        partner_id TEXT,
        access_token TEXT,
        token_expires_at TEXT,
        is_active INTEGER DEFAULT 1,
        last_sync_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Siigo document types
    await pool.query(`
      CREATE TABLE IF NOT EXISTS siigo_document_types (
        id SERIAL PRIMARY KEY,
        siigo_id INTEGER NOT NULL UNIQUE,
        code TEXT,
        name TEXT,
        type TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Siigo payment types
    await pool.query(`
      CREATE TABLE IF NOT EXISTS siigo_payment_types (
        id SERIAL PRIMARY KEY,
        siigo_id INTEGER NOT NULL UNIQUE,
        name TEXT,
        type TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Siigo taxes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS siigo_taxes (
        id SERIAL PRIMARY KEY,
        siigo_id INTEGER NOT NULL UNIQUE,
        name TEXT,
        percentage REAL,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Time Entries
    await pool.query(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        user_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_minutes INTEGER,
        is_running INTEGER DEFAULT 0,
        billable INTEGER DEFAULT 1,
        hourly_rate REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Project Templates
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Project Template Tasks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_template_tasks (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
        estimated_hours REAL DEFAULT 0,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ========================================
    // CLIENT PORTAL TABLES
    // ========================================

    // Client Access Tokens (invitations and sessions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_access_tokens (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        token_type TEXT CHECK(token_type IN ('invite', 'session')) NOT NULL,
        status TEXT CHECK(status IN ('pending', 'active', 'expired', 'revoked')) DEFAULT 'pending',
        expires_at TIMESTAMP,
        activated_at TIMESTAMP,
        last_used_at TIMESTAMP,
        created_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Client Portal Settings (per-client permissions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_portal_settings (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
        can_view_projects INTEGER DEFAULT 1,
        can_view_tasks INTEGER DEFAULT 1,
        can_view_invoices INTEGER DEFAULT 1,
        can_view_metrics INTEGER DEFAULT 1,
        can_approve_tasks INTEGER DEFAULT 1,
        can_comment_tasks INTEGER DEFAULT 1,
        can_view_team INTEGER DEFAULT 0,
        can_download_files INTEGER DEFAULT 1,
        welcome_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Client Comments (comments from clients on tasks)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Client Notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_notifications (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        type TEXT CHECK(type IN ('task_update', 'comment_reply', 'invoice_created', 'project_update', 'approval_needed')) NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        is_read INTEGER DEFAULT 0,
        read_at TIMESTAMP,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add delivery_url column to tasks (link de entrega)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='delivery_url') THEN
          ALTER TABLE tasks ADD COLUMN delivery_url TEXT;
        END IF;
      END $$;
    `);

    // Add created_by column to tasks (who created the task)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='created_by') THEN
          ALTER TABLE tasks ADD COLUMN created_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Add client approval columns to tasks table (if not exists)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='client_approval_status') THEN
          ALTER TABLE tasks ADD COLUMN client_approval_status TEXT CHECK(client_approval_status IN ('pending', 'approved', 'rejected', 'changes_requested'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='client_approval_date') THEN
          ALTER TABLE tasks ADD COLUMN client_approval_date TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='client_approval_notes') THEN
          ALTER TABLE tasks ADD COLUMN client_approval_notes TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='requires_client_approval') THEN
          ALTER TABLE tasks ADD COLUMN requires_client_approval INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='visible_to_client') THEN
          ALTER TABLE tasks ADD COLUMN visible_to_client INTEGER DEFAULT 1;
        END IF;
      END $$;
    `);

    // Add pin_hash column to team_members for authentication (if not exists)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='pin_hash') THEN
          ALTER TABLE team_members ADD COLUMN pin_hash TEXT;
        END IF;
      END $$;
    `);

    // Team member session tokens (legacy — kept for migration compatibility)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_session_tokens (
        id SERIAL PRIMARY KEY,
        team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        status TEXT CHECK(status IN ('active', 'expired', 'revoked')) DEFAULT 'active',
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ========================================
    // MULTI-TENANCY TABLES
    // ========================================

    // Users (global identity: email + PIN)
    await pool.query(`
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

    // Organizations (tenant)
    await pool.query(`
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

    // User session tokens (multi-tenant sessions with current_org_id)
    await pool.query(`
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

    // Add multi-tenancy columns to team_members (if not exists)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='user_id') THEN
          ALTER TABLE team_members ADD COLUMN user_id INTEGER REFERENCES users(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='organization_id') THEN
          ALTER TABLE team_members ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
        END IF;
      END $$;
    `);

    // Add organization_id to root tables (if not exists)
    const rootTablesForOrgId = [
      // Core business entities
      'clients', 'projects', 'invoices', 'expenses', 'commissions',
      // Tasks and related
      'tasks', 'subtasks', 'task_comments', 'task_files', 'board_columns',
      // Project team
      'project_team',
      // Tags and notes
      'tags', 'note_categories', 'note_folders', 'notes',
      // SOPs and templates
      'sop_categories', 'sops', 'project_templates', 'automations',
      // Notifications and activity
      'notifications', 'activity_log', 'time_entries',
      // Client portal and integrations
      'client_access_tokens', 'client_portal_settings', 'client_comments', 'client_notifications',
      'client_facebook_credentials', 'client_shopify_credentials', 'client_daily_metrics', 'metrics_sync_jobs',
      // Siigo (accounting integration)
      'siigo_settings', 'siigo_document_types', 'siigo_payment_types', 'siigo_taxes',
      // Note: 'forms' and 'form_assignments' already have organization_id in their CREATE TABLE
    ];

    for (const table of rootTablesForOrgId) {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='organization_id') THEN
            ALTER TABLE ${table} ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
          END IF;
        END $$;
      `);
    }

    // ========================================
    // BACKFILL: Assign organization_id to orphaned rows
    // ========================================
    try {
      const firstOrg = await pool.query(`SELECT id FROM organizations ORDER BY id LIMIT 1`);
      if (firstOrg.rows.length > 0) {
        const defaultOrgId = firstOrg.rows[0].id;
        let totalBackfilled = 0;
        for (const table of rootTablesForOrgId) {
          const result = await pool.query(
            `UPDATE ${table} SET organization_id = $1 WHERE organization_id IS NULL`,
            [defaultOrgId]
          );
          if (result.rowCount > 0) {
            console.log(`  🔄 Backfill: ${table} — ${result.rowCount} rows assigned to org ${defaultOrgId}`);
            totalBackfilled += result.rowCount;
          }
        }
        // Also backfill team_members
        const tmResult = await pool.query(
          `UPDATE team_members SET organization_id = $1 WHERE organization_id IS NULL`,
          [defaultOrgId]
        );
        if (tmResult.rowCount > 0) {
          console.log(`  🔄 Backfill: team_members — ${tmResult.rowCount} rows assigned to org ${defaultOrgId}`);
          totalBackfilled += tmResult.rowCount;
        }
        if (totalBackfilled > 0) {
          console.log(`  ✅ Backfill complete: ${totalBackfilled} total rows updated`);
        }
      }
    } catch (backfillError) {
      // Organizations table may not exist yet on first run (created by migration)
      console.log('  ⏭️  Backfill skipped (organizations table not ready yet)');
    }

    // ========================================
    // BACKFILL: Migrate existing assigned_to into task_assignees
    // ========================================
    try {
      const backfillResult = await pool.query(`
        INSERT INTO task_assignees (task_id, team_member_id, organization_id)
        SELECT id, assigned_to, organization_id FROM tasks WHERE assigned_to IS NOT NULL
        ON CONFLICT (task_id, team_member_id) DO NOTHING
      `);
      if (backfillResult.rowCount > 0) {
        console.log(`  🔄 Backfill task_assignees: ${backfillResult.rowCount} rows migrated from assigned_to`);
      }
    } catch (backfillAssigneesError) {
      console.log('  ⏭️  task_assignees backfill skipped:', backfillAssigneesError.message);
    }

    // ========================================
    // PERFORMANCE INDEXES
    // ========================================
    console.log('🔄 Creating performance indexes...');

    // Clients indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC)`);

    // Projects indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC)`);

    // Tasks indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON tasks(organization_id)`);

    // Subtasks indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_subtasks_org_id ON subtasks(organization_id)`);

    // Invoices indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date)`);

    // Team members indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email)`);

    // Session tokens indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_session_tokens_token ON team_session_tokens(token)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_session_tokens_member ON team_session_tokens(team_member_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_access_tokens_token ON client_access_tokens(token)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_access_tokens_client ON client_access_tokens(client_id)`);

    // Portal settings index
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_portal_settings_client ON client_portal_settings(client_id)`);

    // Notifications indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);

    // Task assignees indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_assignees_member ON task_assignees(team_member_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_assignees_org ON task_assignees(organization_id)`);

    // Time entries indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id)`);

    // Daily metrics indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_daily_metrics_client ON client_daily_metrics(client_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_daily_metrics_date ON client_daily_metrics(metric_date)`);

    // Cleanup: remove corrupted project templates (pool object saved as name)
    await pool.query(`DELETE FROM project_template_tasks WHERE template_id IN (SELECT id FROM project_templates WHERE name LIKE '{%"_events"%')`);
    await pool.query(`DELETE FROM project_templates WHERE name LIKE '{%"_events"%'`);

    // Multi-tenancy indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_session_tokens_token ON user_session_tokens(token)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_session_tokens_user ON user_session_tokens(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_members_org_id ON team_members(organization_id)`);

    for (const table of rootTablesForOrgId) {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_${table}_org_id ON ${table}(organization_id)`);
    }

    // Add shopify_customers column if not exists
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_daily_metrics' AND column_name='shopify_customers') THEN
          ALTER TABLE client_daily_metrics ADD COLUMN shopify_customers INTEGER DEFAULT 0;
        END IF;
      END $$;
    `);

    // Add expanded metrics columns (Facebook Ads + Shopify)
    const newMetricColumns = [
      { name: 'fb_cpm', type: 'REAL DEFAULT 0' },
      { name: 'fb_cost_per_purchase', type: 'REAL DEFAULT 0' },
      { name: 'fb_landing_page_views', type: 'INTEGER DEFAULT 0' },
      { name: 'fb_cost_per_landing_page_view', type: 'REAL DEFAULT 0' },
      { name: 'fb_video_3sec_views', type: 'INTEGER DEFAULT 0' },
      { name: 'fb_video_thruplay_views', type: 'INTEGER DEFAULT 0' },
      { name: 'fb_hook_rate', type: 'REAL DEFAULT 0' },
      { name: 'fb_hold_rate', type: 'REAL DEFAULT 0' },
      { name: 'shopify_total_tax', type: 'REAL DEFAULT 0' },
      { name: 'shopify_total_discounts', type: 'REAL DEFAULT 0' },
      { name: 'shopify_sessions', type: 'INTEGER DEFAULT 0' },
      { name: 'shopify_conversion_rate', type: 'REAL DEFAULT 0' },
      { name: 'shopify_pending_orders', type: 'INTEGER DEFAULT 0' },
      { name: 'fb_link_clicks', type: 'INTEGER DEFAULT 0' },
      { name: 'fb_add_to_cart', type: 'INTEGER DEFAULT 0' },
    ];

    for (const col of newMetricColumns) {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_daily_metrics' AND column_name='${col.name}') THEN
            ALTER TABLE client_daily_metrics ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    // ========================================
    // AI INSIGHTS
    // ========================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_insights (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        insight_type TEXT DEFAULT 'weekly',
        content TEXT NOT NULL,
        metrics_snapshot JSONB,
        week_start TEXT,
        week_end TEXT,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ========================================
    // DASHBOARD SHARE TOKENS
    // ========================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dashboard_share_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        created_by INTEGER REFERENCES team_members(id),
        status TEXT CHECK(status IN ('active', 'revoked')) DEFAULT 'active',
        expires_at TIMESTAMP,
        access_count INTEGER DEFAULT 0,
        last_accessed_at TIMESTAMP,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ========================================
    // CRM TABLES
    // ========================================

    // Pipeline stages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        color TEXT DEFAULT '#6B7280',
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Deals
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_deals (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        client_name TEXT,
        email TEXT,
        phone TEXT,
        company TEXT,
        source TEXT,
        estimated_value REAL DEFAULT 0,
        stage_id INTEGER REFERENCES crm_pipeline_stages(id) ON DELETE SET NULL,
        notes TEXT,
        assigned_to INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        won_at TIMESTAMP,
        lost_at TIMESTAMP,
        lost_reason TEXT,
        converted_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Deal activities
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_activities (
        id SERIAL PRIMARY KEY,
        deal_id INTEGER NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
        type TEXT CHECK(type IN ('note','call','email','meeting','transcript','stage_change','proposal_sent')) NOT NULL,
        title TEXT,
        content TEXT,
        metadata JSONB DEFAULT '{}',
        created_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ========================================
    // PROPOSAL TEMPLATES
    // ========================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS proposal_templates (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        template_path TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ==========================================
    // FORMS (Formularios)
    // ==========================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forms (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT CHECK(status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
        created_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_forms_org_id ON forms(organization_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS form_sections (
        id SERIAL PRIMARY KEY,
        form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_sections_form_id ON form_sections(form_id)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS form_fields (
        id SERIAL PRIMARY KEY,
        section_id INTEGER NOT NULL REFERENCES form_sections(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        field_type TEXT CHECK(field_type IN ('short_text', 'number', 'multiple_choice', 'yes_no')) NOT NULL,
        help_text TEXT,
        options JSONB,
        is_required INTEGER DEFAULT 0,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_fields_section_id ON form_fields(section_id)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS form_assignments (
        id SERIAL PRIMARY KEY,
        form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        status TEXT CHECK(status IN ('pending', 'draft', 'submitted')) DEFAULT 'pending',
        due_date TEXT,
        assigned_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_assignments_org_id ON form_assignments(organization_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_assignments_form_id ON form_assignments(form_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_assignments_client_id ON form_assignments(client_id)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS form_responses (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL UNIQUE REFERENCES form_assignments(id) ON DELETE CASCADE,
        data JSONB NOT NULL DEFAULT '{}',
        submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_responses_assignment_id ON form_responses(assignment_id)`);

    // Add share_token to forms table
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='forms' AND column_name='share_token') THEN
          ALTER TABLE forms ADD COLUMN share_token TEXT UNIQUE;
        END IF;
      END $$
    `);

    // Public form responses (from shareable links)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS form_public_responses (
        id SERIAL PRIMARY KEY,
        form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        respondent_name TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_public_responses_form_id ON form_public_responses(form_id)`);

    // Add can_view_forms to client_portal_settings
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_portal_settings' AND column_name='can_view_forms') THEN
          ALTER TABLE client_portal_settings ADD COLUMN can_view_forms INTEGER DEFAULT 1;
        END IF;
      END $$
    `);

    // Seed default pipeline stages (only if empty)
    const stageCount = await pool.query('SELECT COUNT(*) as count FROM crm_pipeline_stages');
    if (parseInt(stageCount.rows[0].count) === 0) {
      const defaultStages = [
        { name: 'Lead', position: 0, color: '#6B7280' },
        { name: 'Contactado', position: 1, color: '#3B82F6' },
        { name: 'Reunión', position: 2, color: '#8B5CF6' },
        { name: 'Propuesta Enviada', position: 3, color: '#F59E0B' },
        { name: 'Negociación', position: 4, color: '#EF4444' },
        { name: 'Cliente Ganado', position: 5, color: '#22C55E' },
        { name: 'Perdido', position: 6, color: '#DC2626' },
      ];
      for (const stage of defaultStages) {
        await pool.query(
          'INSERT INTO crm_pipeline_stages (name, position, color) VALUES ($1, $2, $3)',
          [stage.name, stage.position, stage.color]
        );
      }
    }

    // Seed default proposal templates (only if empty)
    const templateCount = await pool.query('SELECT COUNT(*) as count FROM proposal_templates');
    if (parseInt(templateCount.rows[0].count) === 0) {
      await pool.query(
        `INSERT INTO proposal_templates (slug, name, description, template_path, variables)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'shopify-migration',
          'Migración/Creación Shopify',
          'Propuesta de migración o creación de sitio web en Shopify + Contenido IA opcional',
          '/Users/realjuanfe/plantillas-presentaciones/migracion-shopify/plantilla.html',
          JSON.stringify([
            'NOMBRE_CLIENTE', 'LOGO_CLIENTE', 'PAIN_1', 'PAIN_2', 'PAIN_3', 'PAIN_4',
            'PRECIO_BASICO', 'PRECIO_PRO', 'PRECIO_PREMIUM'
          ])
        ]
      );
      await pool.query(
        `INSERT INTO proposal_templates (slug, name, description, template_path, variables)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'pauta-metodo-real',
          'Pauta + Método REAL',
          'Propuesta de gestión de pauta digital con acompañamiento en Método REAL',
          '/Users/realjuanfe/plantillas-presentaciones/pauta-metodo-real/plantilla.html',
          JSON.stringify([
            'NOMBRE_CLIENTE', 'LOGO_CLIENTE', 'INVERSION_MENSUAL', 'PAIN_1', 'PAIN_2',
            'PRECIO_PAUTA', 'PRECIO_METODO'
          ])
        ]
      );
    }

    console.log('✅ PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

export default db;
