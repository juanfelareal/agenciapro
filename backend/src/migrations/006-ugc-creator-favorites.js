/**
 * Migration 006: Add favorites support for UGC creators
 *
 * Adds is_favorite column to ugc_creators table to allow marking
 * favorite creators for quick access, filterable by category/industry.
 */

import db from '../config/database.js';

export async function up() {
  console.log('Running migration 006: Adding favorites to UGC creators...');

  // Add is_favorite column to ugc_creators
  await db.run(`
    ALTER TABLE ugc_creators
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE
  `);

  // Create index for faster filtering
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_ugc_creators_favorite
    ON ugc_creators(organization_id, is_favorite)
    WHERE is_favorite = TRUE
  `);

  console.log('Migration 006 complete: Favorites column added to ugc_creators');
}

export async function down() {
  console.log('Rolling back migration 006...');

  await db.run(`DROP INDEX IF EXISTS idx_ugc_creators_favorite`);
  await db.run(`ALTER TABLE ugc_creators DROP COLUMN IF EXISTS is_favorite`);

  console.log('Migration 006 rollback complete');
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
