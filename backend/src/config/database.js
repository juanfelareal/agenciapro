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
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection on pool creation
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});

pool.on('connect', () => {
  console.log('✅ PostgreSQL pool: New client connected');
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
      'clients', 'projects', 'invoices', 'expenses', 'commissions',
      'tags', 'note_categories', 'note_folders', 'notes',
      'sop_categories', 'sops', 'project_templates', 'automations',
      'notifications', 'activity_log', 'siigo_settings',
      'siigo_document_types', 'siigo_payment_types', 'siigo_taxes', 'time_entries'
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

    console.log('✅ PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

export default db;
