import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use DATABASE_PATH env var for production (Railway volume), fallback to local for development
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../agenciapro.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export const initializeDatabase = () => {
  // Clients table (CRM)
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
      contract_value REAL DEFAULT 0,
      contract_start_date TEXT,
      contract_end_date TEXT,
      notes TEXT,
      is_recurring INTEGER DEFAULT 0,
      billing_day INTEGER,
      recurring_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Team members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('admin', 'manager', 'member')) DEFAULT 'member',
      position TEXT,
      status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
      hire_date TEXT,
      birthday TEXT,
      permissions TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      client_id INTEGER,
      status TEXT CHECK(status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')) DEFAULT 'planning',
      budget REAL DEFAULT 0,
      spent REAL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    )
  `);

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      project_id INTEGER,
      assigned_to INTEGER,
      status TEXT CHECK(status IN ('todo', 'in_progress', 'review', 'done')) DEFAULT 'todo',
      priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
      due_date TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurrence_pattern TEXT,
      parent_task_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES team_members(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Project team assignments (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      team_member_id INTEGER NOT NULL,
      role TEXT,
      assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
      UNIQUE(project_id, team_member_id)
    )
  `);

  // Invoices table (income)
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      project_id INTEGER,
      amount REAL NOT NULL,
      status TEXT CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')) DEFAULT 'draft',
      issue_date TEXT NOT NULL,
      due_date TEXT,
      paid_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `);

  // Expenses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      category TEXT,
      amount REAL NOT NULL,
      project_id INTEGER,
      expense_date TEXT NOT NULL,
      payment_method TEXT,
      receipt_url TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `);

  // Commissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_member_id INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      net_sales REAL NOT NULL,
      commission_amount REAL NOT NULL,
      status TEXT CHECK(status IN ('pending', 'approved', 'paid')) DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
      UNIQUE(team_member_id, month, year)
    )
  `);

  // Board columns (Columnas personalizables estilo Monday.com)
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      column_name TEXT NOT NULL,
      column_type TEXT NOT NULL,
      column_order INTEGER DEFAULT 0,
      settings TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Board column values (Valores de cada celda)
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_column_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      column_id INTEGER NOT NULL,
      value TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE CASCADE,
      UNIQUE(task_id, column_id)
    )
  `);

  // Task dependencies (Dependencias entre tareas)
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      depends_on_task_id INTEGER NOT NULL,
      dependency_type TEXT CHECK(dependency_type IN ('FS', 'SS', 'FF', 'SF')) DEFAULT 'FS',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Task comments (Comentarios en tareas)
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES team_members(id) ON DELETE CASCADE
    )
  `);

  // Task files (Archivos adjuntos)
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      uploaded_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES team_members(id) ON DELETE SET NULL
    )
  `);

  // Subtasks (Checklist items for tasks)
  db.exec(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Tags (for task organization)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366F1',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Task Tags (many-to-many relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, tag_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Invoice status history (Historial de estados de facturas)
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by INTEGER,
      changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES team_members(id) ON DELETE SET NULL
    )
  `);

  // Activity log (Registro de actividades)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      description TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES team_members(id) ON DELETE SET NULL
    )
  `);

  // Automations (Reglas de automatización)
  db.exec(`
    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_conditions TEXT,
      action_type TEXT NOT NULL,
      action_params TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Notifications (Sistema de notificaciones)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('task_assigned', 'comment', 'mention', 'task_updated', 'task_due', 'task_completed', 'automation')) NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      related_task_id INTEGER,
      is_read INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT,
      FOREIGN KEY (user_id) REFERENCES team_members(id) ON DELETE CASCADE,
      FOREIGN KEY (related_task_id) REFERENCES tasks(id) ON DELETE SET NULL
    )
  `);

  // Note Categories (Categorías de notas)
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366F1',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Note Folders (Carpetas para notas tipo Notion)
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      icon TEXT DEFAULT '📁',
      color TEXT DEFAULT '#6366F1',
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES note_folders(id) ON DELETE CASCADE
    )
  `);

  // Notes (Bloc de notas estilo Notion)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      content_plain TEXT,
      color TEXT DEFAULT '#FFFFFF',
      category_id INTEGER,
      is_pinned INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES note_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES team_members(id) ON DELETE SET NULL
    )
  `);

  // Note Links (Enlaces de notas a entidades - multi-entity)
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      client_id INTEGER,
      project_id INTEGER,
      team_member_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
    )
  `);

  // ============================================
  // PLATFORM INTEGRATIONS (Facebook Ads & Shopify)
  // ============================================

  // Facebook Ads credentials per client (allows multiple accounts per client)
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_facebook_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      access_token TEXT NOT NULL,
      ad_account_id TEXT NOT NULL,
      ad_account_name TEXT,
      status TEXT CHECK(status IN ('active', 'inactive', 'expired', 'error')) DEFAULT 'active',
      last_sync_at TEXT,
      last_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      UNIQUE(client_id, ad_account_id)
    )
  `);

  // Shopify credentials per client
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_shopify_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL UNIQUE,
      store_url TEXT NOT NULL,
      access_token TEXT NOT NULL,
      status TEXT CHECK(status IN ('active', 'inactive', 'error')) DEFAULT 'active',
      last_sync_at TEXT,
      last_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )
  `);

  // Daily metrics per client (Facebook Ads + Shopify combined)
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_daily_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      metric_date TEXT NOT NULL,

      -- Shopify metrics
      shopify_revenue REAL DEFAULT 0,
      shopify_orders INTEGER DEFAULT 0,
      shopify_aov REAL DEFAULT 0,
      shopify_refunds REAL DEFAULT 0,
      shopify_net_revenue REAL DEFAULT 0,

      -- Facebook Ads metrics
      fb_spend REAL DEFAULT 0,
      fb_impressions INTEGER DEFAULT 0,
      fb_clicks INTEGER DEFAULT 0,
      fb_ctr REAL DEFAULT 0,
      fb_cpc REAL DEFAULT 0,
      fb_conversions INTEGER DEFAULT 0,
      fb_revenue REAL DEFAULT 0,
      fb_roas REAL DEFAULT 0,

      -- Calculated/Combined metrics
      total_revenue REAL DEFAULT 0,
      overall_roas REAL DEFAULT 0,
      cost_per_order REAL DEFAULT 0,
      ad_spend_percentage REAL DEFAULT 0,

      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      UNIQUE(client_id, metric_date)
    )
  `);

  // Metrics sync job history
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics_sync_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      job_type TEXT CHECK(job_type IN ('facebook', 'shopify', 'all')) NOT NULL,
      status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
      started_at TEXT,
      completed_at TEXT,
      records_processed INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    )
  `);

  // Migrations - Add new columns if they don't exist
  try {
    // Check tasks table
    const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
    const hasIsRecurring = tableInfo.some(col => col.name === 'is_recurring');
    const hasRecurrencePattern = tableInfo.some(col => col.name === 'recurrence_pattern');
    const hasParentTaskId = tableInfo.some(col => col.name === 'parent_task_id');

    // Check clients table
    const clientsTableInfo = db.prepare("PRAGMA table_info(clients)").all();
    const hasNit = clientsTableInfo.some(col => col.name === 'nit');
    const hasClientIsRecurring = clientsTableInfo.some(col => col.name === 'is_recurring');
    const hasBillingDay = clientsTableInfo.some(col => col.name === 'billing_day');
    const hasRecurringAmount = clientsTableInfo.some(col => col.name === 'recurring_amount');

    // Check team_members table
    const teamInfo = db.prepare("PRAGMA table_info(team_members)").all();
    const hasHireDate = teamInfo.some(col => col.name === 'hire_date');
    const hasBirthday = teamInfo.some(col => col.name === 'birthday');
    const hasPermissions = teamInfo.some(col => col.name === 'permissions');

    if (!hasIsRecurring) {
      db.exec('ALTER TABLE tasks ADD COLUMN is_recurring INTEGER DEFAULT 0');
      console.log('✅ Added is_recurring column to tasks table');
    }
    if (!hasRecurrencePattern) {
      db.exec('ALTER TABLE tasks ADD COLUMN recurrence_pattern TEXT');
      console.log('✅ Added recurrence_pattern column to tasks table');
    }
    if (!hasParentTaskId) {
      db.exec('ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE');
      console.log('✅ Added parent_task_id column to tasks table');
    }
    if (!hasNit) {
      db.exec('ALTER TABLE clients ADD COLUMN nit TEXT');
      console.log('✅ Added nit column to clients table');
    }
    if (!hasClientIsRecurring) {
      db.exec('ALTER TABLE clients ADD COLUMN is_recurring INTEGER DEFAULT 0');
      console.log('✅ Added is_recurring column to clients table');
    }
    if (!hasBillingDay) {
      db.exec('ALTER TABLE clients ADD COLUMN billing_day INTEGER');
      console.log('✅ Added billing_day column to clients table');
    }
    if (!hasRecurringAmount) {
      db.exec('ALTER TABLE clients ADD COLUMN recurring_amount REAL DEFAULT 0');
      console.log('✅ Added recurring_amount column to clients table');
    }
    if (!hasHireDate) {
      db.exec('ALTER TABLE team_members ADD COLUMN hire_date TEXT');
      console.log('✅ Added hire_date column to team_members table');
    }
    if (!hasBirthday) {
      db.exec('ALTER TABLE team_members ADD COLUMN birthday TEXT');
      console.log('✅ Added birthday column to team_members table');
    }
    if (!hasPermissions) {
      db.exec('ALTER TABLE team_members ADD COLUMN permissions TEXT');
      console.log('✅ Added permissions column to team_members table');
    }

    // Check tasks table for Monday.com style fields
    const tasksTableInfo = db.prepare("PRAGMA table_info(tasks)").all();
    const hasTimelineStart = tasksTableInfo.some(col => col.name === 'timeline_start');
    const hasTimelineEnd = tasksTableInfo.some(col => col.name === 'timeline_end');
    const hasProgress = tasksTableInfo.some(col => col.name === 'progress');
    const hasColor = tasksTableInfo.some(col => col.name === 'color');
    const hasEstimatedHours = tasksTableInfo.some(col => col.name === 'estimated_hours');

    if (!hasTimelineStart) {
      db.exec('ALTER TABLE tasks ADD COLUMN timeline_start TEXT');
      console.log('✅ Added timeline_start column to tasks table');
    }
    if (!hasTimelineEnd) {
      db.exec('ALTER TABLE tasks ADD COLUMN timeline_end TEXT');
      console.log('✅ Added timeline_end column to tasks table');
    }
    if (!hasProgress) {
      db.exec('ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0');
      console.log('✅ Added progress column to tasks table');
    }
    if (!hasColor) {
      db.exec('ALTER TABLE tasks ADD COLUMN color TEXT');
      console.log('✅ Added color column to tasks table');
    }
    if (!hasEstimatedHours) {
      db.exec('ALTER TABLE tasks ADD COLUMN estimated_hours REAL');
      console.log('✅ Added estimated_hours column to tasks table');
    }

    // Check invoices table for invoice_type and payment_proof fields
    const invoicesTableInfo = db.prepare("PRAGMA table_info(invoices)").all();
    const hasInvoiceType = invoicesTableInfo.some(col => col.name === 'invoice_type');
    const hasPaymentProof = invoicesTableInfo.some(col => col.name === 'payment_proof');

    if (!hasInvoiceType) {
      db.exec("ALTER TABLE invoices ADD COLUMN invoice_type TEXT DEFAULT 'con_iva'");
      console.log('✅ Added invoice_type column to invoices table');
    }
    if (!hasPaymentProof) {
      db.exec("ALTER TABLE invoices ADD COLUMN payment_proof TEXT");
      console.log('✅ Added payment_proof column to invoices table');
    }

    // Check for recurring invoice fields
    const hasIsRecurringInvoice = invoicesTableInfo.some(col => col.name === 'is_recurring');
    const hasRecurrenceFrequency = invoicesTableInfo.some(col => col.name === 'recurrence_frequency');
    const hasRecurrenceStatus = invoicesTableInfo.some(col => col.name === 'recurrence_status');
    const hasNextRecurrenceDate = invoicesTableInfo.some(col => col.name === 'next_recurrence_date');

    if (!hasIsRecurringInvoice) {
      db.exec("ALTER TABLE invoices ADD COLUMN is_recurring INTEGER DEFAULT 0");
      console.log('✅ Added is_recurring column to invoices table');
    }
    if (!hasRecurrenceFrequency) {
      db.exec("ALTER TABLE invoices ADD COLUMN recurrence_frequency TEXT");
      console.log('✅ Added recurrence_frequency column to invoices table');
    }
    if (!hasRecurrenceStatus) {
      db.exec("ALTER TABLE invoices ADD COLUMN recurrence_status TEXT DEFAULT 'draft'");
      console.log('✅ Added recurrence_status column to invoices table');
    }
    if (!hasNextRecurrenceDate) {
      db.exec("ALTER TABLE invoices ADD COLUMN next_recurrence_date TEXT");
      console.log('✅ Added next_recurrence_date column to invoices table');
    }

    // Migrate invoices table to new status values (remove old CHECK constraint)
    // Check if we need to migrate by looking at the table SQL
    const invoicesTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='invoices'").get();
    if (invoicesTableSql && invoicesTableSql.sql && invoicesTableSql.sql.includes("'sent'") && !invoicesTableSql.sql.includes("'approved'")) {
      console.log('🔄 Migrating invoices table to new status values...');

      // Create new table with updated status constraint
      db.exec(`
        CREATE TABLE invoices_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_number TEXT UNIQUE NOT NULL,
          client_id INTEGER NOT NULL,
          project_id INTEGER,
          amount REAL NOT NULL,
          status TEXT CHECK(status IN ('draft', 'approved', 'invoiced', 'paid')) DEFAULT 'draft',
          issue_date TEXT NOT NULL,
          due_date TEXT,
          paid_date TEXT,
          notes TEXT,
          invoice_type TEXT DEFAULT 'con_iva',
          payment_proof TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        )
      `);

      // Copy data, converting old statuses to new ones
      db.exec(`
        INSERT INTO invoices_new (id, invoice_number, client_id, project_id, amount, status, issue_date, due_date, paid_date, notes, invoice_type, payment_proof, created_at, updated_at)
        SELECT id, invoice_number, client_id, project_id, amount,
          CASE
            WHEN status = 'sent' THEN 'approved'
            WHEN status = 'overdue' THEN 'invoiced'
            WHEN status = 'cancelled' THEN 'draft'
            ELSE status
          END,
          issue_date, due_date, paid_date, notes, invoice_type, payment_proof, created_at, updated_at
        FROM invoices
      `);

      // Drop old table and rename new one
      db.exec('DROP TABLE invoices');
      db.exec('ALTER TABLE invoices_new RENAME TO invoices');

      // Recreate index
      db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)');

      console.log('✅ Migrated invoices table to new status values');
    }

    // Check commissions table for client_id and otros fields
    const commissionsTableInfo = db.prepare("PRAGMA table_info(commissions)").all();
    const hasClientId = commissionsTableInfo.some(col => col.name === 'client_id');
    const hasOtros = commissionsTableInfo.some(col => col.name === 'otros');

    if (!hasClientId) {
      db.exec('ALTER TABLE commissions ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL');
      console.log('✅ Added client_id column to commissions table');
    }
    if (!hasOtros) {
      db.exec('ALTER TABLE commissions ADD COLUMN otros TEXT');
      console.log('✅ Added otros column to commissions table');
    }

    // Migrate client_facebook_credentials to allow multiple accounts per client
    const fbCredsTableInfo = db.prepare("PRAGMA table_info(client_facebook_credentials)").all();
    const hasAdAccountName = fbCredsTableInfo.some(col => col.name === 'ad_account_name');

    if (!hasAdAccountName && fbCredsTableInfo.length > 0) {
      console.log('🔄 Migrating client_facebook_credentials table...');

      // Add ad_account_name column
      try {
        db.exec('ALTER TABLE client_facebook_credentials ADD COLUMN ad_account_name TEXT');
        console.log('✅ Added ad_account_name column');
      } catch (e) {
        // Column might already exist
      }

      // Check if we need to remove the old UNIQUE constraint on client_id only
      const fbIndexList = db.prepare("PRAGMA index_list(client_facebook_credentials)").all();
      const hasOldUniqueConstraint = fbIndexList.some(idx =>
        idx.unique === 1 && idx.name.includes('sqlite_autoindex')
      );

      if (hasOldUniqueConstraint) {
        console.log('🔄 Recreating client_facebook_credentials with new constraints...');

        // Create new table with correct constraints
        db.exec(`
          CREATE TABLE IF NOT EXISTS client_facebook_credentials_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            access_token TEXT NOT NULL,
            ad_account_id TEXT NOT NULL,
            ad_account_name TEXT,
            status TEXT CHECK(status IN ('active', 'inactive', 'expired', 'error')) DEFAULT 'active',
            last_sync_at TEXT,
            last_error TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            UNIQUE(client_id, ad_account_id)
          )
        `);

        // Copy data
        db.exec(`
          INSERT INTO client_facebook_credentials_new
            (id, client_id, access_token, ad_account_id, ad_account_name, status, last_sync_at, last_error, created_at, updated_at)
          SELECT id, client_id, access_token, ad_account_id, ad_account_name, status, last_sync_at, last_error, created_at, updated_at
          FROM client_facebook_credentials
        `);

        // Drop old table and rename
        db.exec('DROP TABLE client_facebook_credentials');
        db.exec('ALTER TABLE client_facebook_credentials_new RENAME TO client_facebook_credentials');

        console.log('✅ Migrated client_facebook_credentials table');
      }
    }

    // Remove UNIQUE constraint from commissions table to allow multiple commissions per member per month
    // Check if the unique constraint exists by looking at index info
    const indexList = db.prepare("PRAGMA index_list(commissions)").all();
    const hasUniqueConstraint = indexList.some(idx => idx.unique === 1 && idx.name.includes('sqlite_autoindex'));

    if (hasUniqueConstraint) {
      console.log('🔄 Migrating commissions table to remove UNIQUE constraint...');

      // Create new table without UNIQUE constraint
      db.exec(`
        CREATE TABLE IF NOT EXISTS commissions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          team_member_id INTEGER NOT NULL,
          client_id INTEGER,
          otros TEXT,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          net_sales REAL NOT NULL,
          commission_amount REAL NOT NULL,
          status TEXT CHECK(status IN ('pending', 'approved', 'paid')) DEFAULT 'pending',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
        )
      `);

      // Copy data from old table
      db.exec(`
        INSERT INTO commissions_new (id, team_member_id, client_id, otros, month, year, net_sales, commission_amount, status, notes, created_at, updated_at)
        SELECT id, team_member_id, client_id, otros, month, year, net_sales, commission_amount, status, notes, created_at, updated_at
        FROM commissions
      `);

      // Drop old table
      db.exec('DROP TABLE commissions');

      // Rename new table
      db.exec('ALTER TABLE commissions_new RENAME TO commissions');

      console.log('✅ Removed UNIQUE constraint from commissions table');
    }
  } catch (error) {
    console.log('Migration check skipped:', error.message);
  }

  // Notes folder migration
  try {
    const notesInfo = db.prepare("PRAGMA table_info(notes)").all();
    const hasFolderId = notesInfo.some(col => col.name === 'folder_id');

    if (!hasFolderId) {
      db.exec('ALTER TABLE notes ADD COLUMN folder_id INTEGER REFERENCES note_folders(id) ON DELETE SET NULL');
      console.log('✅ Added folder_id column to notes table');
    }
  } catch (error) {
    console.log('Notes folder migration:', error.message);
  }

  // Siigo integration migrations
  try {
    // Add siigo_id to invoices
    const invoicesInfo = db.prepare("PRAGMA table_info(invoices)").all();
    const hasSiigoInvoiceId = invoicesInfo.some(col => col.name === 'siigo_id');
    const hasSiigoStatus = invoicesInfo.some(col => col.name === 'siigo_status');

    if (!hasSiigoInvoiceId) {
      db.exec('ALTER TABLE invoices ADD COLUMN siigo_id TEXT');
      console.log('✅ Added siigo_id column to invoices table');
    }
    if (!hasSiigoStatus) {
      db.exec("ALTER TABLE invoices ADD COLUMN siigo_status TEXT DEFAULT 'pending'");
      console.log('✅ Added siigo_status column to invoices table');
    }

    // Add siigo_id to clients
    const clientsInfo = db.prepare("PRAGMA table_info(clients)").all();
    const hasSiigoClientId = clientsInfo.some(col => col.name === 'siigo_id');

    if (!hasSiigoClientId) {
      db.exec('ALTER TABLE clients ADD COLUMN siigo_id TEXT');
      console.log('✅ Added siigo_id column to clients table');
    }
  } catch (error) {
    console.log('Siigo migration check:', error.message);
  }

  // ============================================
  // SOPs (Standard Operating Procedures)
  // ============================================

  // SOP Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS sop_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#6366F1',
      icon TEXT DEFAULT 'folder',
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // SOPs (Standard Operating Procedures)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE,
      description TEXT,
      content TEXT,
      steps TEXT,
      editor_mode TEXT CHECK(editor_mode IN ('freeform', 'steps')) DEFAULT 'freeform',
      category_id INTEGER,
      created_by INTEGER,
      status TEXT CHECK(status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
      version INTEGER DEFAULT 1,
      view_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      published_at TEXT,
      FOREIGN KEY (category_id) REFERENCES sop_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES team_members(id) ON DELETE SET NULL
    )
  `);

  // Add steps and editor_mode columns if they don't exist (migration for existing databases)
  try {
    db.exec(`ALTER TABLE sops ADD COLUMN steps TEXT`);
  } catch (e) { /* Column may already exist */ }
  try {
    db.exec(`ALTER TABLE sops ADD COLUMN editor_mode TEXT DEFAULT 'freeform'`);
  } catch (e) { /* Column may already exist */ }

  // SOP Revisions (version history)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sop_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sop_id INTEGER NOT NULL,
      content TEXT,
      version INTEGER NOT NULL,
      changed_by INTEGER,
      change_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sop_id) REFERENCES sops(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES team_members(id) ON DELETE SET NULL
    )
  `);

  // ============================================
  // SIIGO INTEGRATION
  // ============================================

  // Siigo API credentials (company-wide settings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS siigo_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      access_key TEXT NOT NULL,
      partner_id TEXT,
      access_token TEXT,
      token_expires_at TEXT,
      is_active INTEGER DEFAULT 1,
      last_sync_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add partner_id column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE siigo_settings ADD COLUMN partner_id TEXT`);
  } catch (e) {
    // Column already exists
  }

  // Siigo document types cache (fetched from API)
  db.exec(`
    CREATE TABLE IF NOT EXISTS siigo_document_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siigo_id INTEGER NOT NULL UNIQUE,
      code TEXT,
      name TEXT,
      type TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Siigo payment types cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS siigo_payment_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siigo_id INTEGER NOT NULL UNIQUE,
      name TEXT,
      type TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Siigo taxes cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS siigo_taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siigo_id INTEGER NOT NULL UNIQUE,
      name TEXT,
      percentage REAL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============================================
  // TIME TRACKING
  // ============================================

  // Time Entries (for time tracking feature)
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      project_id INTEGER,
      user_id INTEGER NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes INTEGER,
      is_running INTEGER DEFAULT 0,
      billable INTEGER DEFAULT 1,
      hourly_rate REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES team_members(id) ON DELETE CASCADE
    )
  `);

  // ============================================
  // PROJECT TEMPLATES
  // ============================================

  // Project Templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Project Template Tasks (predefined tasks for each template)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_template_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
      estimated_hours REAL DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES project_templates(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
    CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
    CREATE INDEX IF NOT EXISTS idx_board_columns_project ON board_columns(project_id);
    CREATE INDEX IF NOT EXISTS idx_board_column_values_task ON board_column_values(task_id);
    CREATE INDEX IF NOT EXISTS idx_board_column_values_column ON board_column_values(column_id);
    CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends ON task_dependencies(depends_on_task_id);
    CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_files_task ON task_files(task_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_automations_project ON automations(project_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_commissions_team_member ON commissions(team_member_id);
    CREATE INDEX IF NOT EXISTS idx_commissions_period ON commissions(year, month);
    CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
    CREATE INDEX IF NOT EXISTS idx_commissions_client ON commissions(client_id);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned DESC, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category_id);
    CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by);
    CREATE INDEX IF NOT EXISTS idx_note_links_note ON note_links(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_links_client ON note_links(client_id);
    CREATE INDEX IF NOT EXISTS idx_note_links_project ON note_links(project_id);
    CREATE INDEX IF NOT EXISTS idx_note_links_team ON note_links(team_member_id);
    CREATE INDEX IF NOT EXISTS idx_note_folders_parent ON note_folders(parent_id);
    CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);

    CREATE INDEX IF NOT EXISTS idx_fb_credentials_client ON client_facebook_credentials(client_id);
    CREATE INDEX IF NOT EXISTS idx_fb_credentials_status ON client_facebook_credentials(status);
    CREATE INDEX IF NOT EXISTS idx_shopify_credentials_client ON client_shopify_credentials(client_id);
    CREATE INDEX IF NOT EXISTS idx_shopify_credentials_status ON client_shopify_credentials(status);
    CREATE INDEX IF NOT EXISTS idx_daily_metrics_client ON client_daily_metrics(client_id);
    CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON client_daily_metrics(metric_date);
    CREATE INDEX IF NOT EXISTS idx_daily_metrics_client_date ON client_daily_metrics(client_id, metric_date);
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_client ON metrics_sync_jobs(client_id);
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON metrics_sync_jobs(status);

    CREATE INDEX IF NOT EXISTS idx_sops_category ON sops(category_id);
    CREATE INDEX IF NOT EXISTS idx_sops_status ON sops(status);
    CREATE INDEX IF NOT EXISTS idx_sops_slug ON sops(slug);
    CREATE INDEX IF NOT EXISTS idx_sop_revisions_sop ON sop_revisions(sop_id);

    CREATE INDEX IF NOT EXISTS idx_project_templates_name ON project_templates(name);
    CREATE INDEX IF NOT EXISTS idx_project_template_tasks_template ON project_template_tasks(template_id);
    CREATE INDEX IF NOT EXISTS idx_project_template_tasks_order ON project_template_tasks(template_id, order_index);

    CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_running ON time_entries(is_running);
    CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);
  `);

  console.log('✅ Database initialized successfully');
};

export default db;
