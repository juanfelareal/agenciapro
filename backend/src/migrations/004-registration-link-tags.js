/**
 * Migration 004: Registration Link Tags
 *
 * Adds a tag field to ugc_registration_tokens table
 * to identify where each registration link was used.
 *
 * Run: node --experimental-modules src/migrations/004-registration-link-tags.js
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
    console.log('🚀 Starting registration link tags migration...\n');

    // Check if column exists
    const result = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ugc_registration_tokens' AND column_name = 'tag'
    `);

    if (result.rows.length === 0) {
      await client.query(`ALTER TABLE ugc_registration_tokens ADD COLUMN tag TEXT`);
      console.log('  ✅ tag column added');
    } else {
      console.log('  ⏭️ tag column already exists');
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
