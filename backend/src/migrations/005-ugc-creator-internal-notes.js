/**
 * Migration 005: UGC Creator Internal Notes
 *
 * Creates ugc_creator_notes table for internal notes about creators.
 * These notes are 100% internal - never visible to creators or clients.
 * Notes can optionally be linked to a specific project.
 *
 * Run: node --experimental-modules src/migrations/005-ugc-creator-internal-notes.js
 */

import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;

const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const isLocalDb = dbUrl?.includes('localhost') || dbUrl?.includes('127.0.0.1');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocalDb ? false : { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🚀 Starting UGC creator internal notes migration...\n');

    // Helper function to check if table exists
    const tableExists = async (table) => {
      const result = await client.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_name = $1
      `, [table]);
      return result.rows.length > 0;
    };

    // Create ugc_creator_notes table
    if (!(await tableExists('ugc_creator_notes'))) {
      await client.query(`
        CREATE TABLE ugc_creator_notes (
          id SERIAL PRIMARY KEY,
          creator_id INTEGER NOT NULL REFERENCES ugc_creators(id) ON DELETE CASCADE,
          project_id INTEGER REFERENCES ugc_projects(id) ON DELETE SET NULL,
          content TEXT NOT NULL,
          created_by INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('  ✅ ugc_creator_notes table created');

      // Create indexes for better query performance
      await client.query(`CREATE INDEX idx_ugc_creator_notes_creator ON ugc_creator_notes(creator_id)`);
      await client.query(`CREATE INDEX idx_ugc_creator_notes_project ON ugc_creator_notes(project_id)`);
      console.log('  ✅ indexes created');
    } else {
      console.log('  ⏭️ ugc_creator_notes table already exists');
    }

    await client.query('COMMIT');
    console.log('\n✨ Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
