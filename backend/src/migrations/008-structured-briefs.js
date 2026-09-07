/**
 * Migration 008: Structured Briefs System
 *
 * Adds support for structured briefs with sections (areas) and tasks
 * that automatically generate projects when saved.
 */

import db from '../config/database.js';

export async function up() {
  console.log('Running migration 008: Creating structured briefs tables...');

  // 1. Add brief_type column to briefs (html = legacy, structured = new)
  await db.run(`
    ALTER TABLE briefs
    ADD COLUMN IF NOT EXISTS brief_type TEXT DEFAULT 'html'
  `);

  // 2. Add generated_project_id to link brief to its generated project
  await db.run(`
    ALTER TABLE briefs
    ADD COLUMN IF NOT EXISTS generated_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL
  `);

  // 3. Create brief_sections table (one section per work area)
  await db.run(`
    CREATE TABLE IF NOT EXISTS brief_sections (
      id SERIAL PRIMARY KEY,
      brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
      area_key TEXT NOT NULL,
      area_name TEXT NOT NULL,
      responsible_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
      context_text TEXT,
      order_index INTEGER DEFAULT 0,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Create brief_section_tasks table (tasks within each section)
  await db.run(`
    CREATE TABLE IF NOT EXISTS brief_section_tasks (
      id SERIAL PRIMARY KEY,
      section_id INTEGER NOT NULL REFERENCES brief_sections(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATE,
      priority TEXT DEFAULT 'medium',
      order_index INTEGER DEFAULT 0,
      generated_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Create indexes for efficient queries
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_brief_sections_brief_id
    ON brief_sections(brief_id)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_brief_section_tasks_section_id
    ON brief_section_tasks(section_id)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_briefs_generated_project_id
    ON briefs(generated_project_id)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_briefs_brief_type
    ON briefs(organization_id, brief_type)
  `);

  console.log('Migration 008 complete: Structured briefs tables created');
}

export async function down() {
  console.log('Rolling back migration 008...');

  await db.run(`DROP INDEX IF EXISTS idx_briefs_brief_type`);
  await db.run(`DROP INDEX IF EXISTS idx_briefs_generated_project_id`);
  await db.run(`DROP INDEX IF EXISTS idx_brief_section_tasks_section_id`);
  await db.run(`DROP INDEX IF EXISTS idx_brief_sections_brief_id`);
  await db.run(`DROP TABLE IF EXISTS brief_section_tasks`);
  await db.run(`DROP TABLE IF EXISTS brief_sections`);
  await db.run(`ALTER TABLE briefs DROP COLUMN IF EXISTS generated_project_id`);
  await db.run(`ALTER TABLE briefs DROP COLUMN IF EXISTS brief_type`);

  console.log('Migration 008 rollback complete');
}

// Run migration if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
