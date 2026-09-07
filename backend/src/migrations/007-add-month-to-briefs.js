/**
 * Migration 007: Add month field to briefs
 *
 * Adds a month column (YYYY-MM format) to briefs table
 * to allow filtering briefs by month.
 */

import db from '../config/database.js';

export async function up() {
  console.log('Running migration 007: Adding month field to briefs...');

  // Add month column to briefs (format: 'YYYY-MM', e.g., '2026-09')
  await db.run(`
    ALTER TABLE briefs
    ADD COLUMN IF NOT EXISTS month TEXT
  `);

  // Create index for faster filtering by month
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_briefs_month
    ON briefs(organization_id, month)
  `);

  console.log('Migration 007 complete: Month column added to briefs');
}

export async function down() {
  console.log('Rolling back migration 007...');

  await db.run(`DROP INDEX IF EXISTS idx_briefs_month`);
  await db.run(`ALTER TABLE briefs DROP COLUMN IF EXISTS month`);

  console.log('Migration 007 rollback complete');
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
