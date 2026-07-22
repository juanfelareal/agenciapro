/**
 * Migration 003: UGC Creator Extended Fields
 *
 * Adds new fields to ugc_creators table:
 * - portfolio (JSONB) - video links
 * - rate_per_video (INTEGER) - tarifa por video en COP
 * - traits (JSONB) - appearance and lifestyle characteristics
 * - languages (TEXT[]) - array of languages
 * - equipment (TEXT[]) - array of equipment
 * - availability (JSONB) - videos per week and delivery time
 *
 * Run: node --experimental-modules src/migrations/003-ugc-creator-fields.js
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
    console.log('🚀 Starting UGC creator fields migration...\n');

    // Helper function to check if column exists
    const columnExists = async (table, column) => {
      const result = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      `, [table, column]);
      return result.rows.length > 0;
    };

    // Add portfolio column (JSONB)
    if (!(await columnExists('ugc_creators', 'portfolio'))) {
      await client.query(`ALTER TABLE ugc_creators ADD COLUMN portfolio JSONB DEFAULT '{}'`);
      console.log('  ✅ portfolio column added');
    } else {
      console.log('  ⏭️ portfolio column already exists');
    }

    // Add rate_per_video column (INTEGER)
    if (!(await columnExists('ugc_creators', 'rate_per_video'))) {
      await client.query(`ALTER TABLE ugc_creators ADD COLUMN rate_per_video INTEGER`);
      console.log('  ✅ rate_per_video column added');
    } else {
      console.log('  ⏭️ rate_per_video column already exists');
    }

    // Add traits column (JSONB)
    if (!(await columnExists('ugc_creators', 'traits'))) {
      await client.query(`ALTER TABLE ugc_creators ADD COLUMN traits JSONB DEFAULT '{}'`);
      console.log('  ✅ traits column added');
    } else {
      console.log('  ⏭️ traits column already exists');
    }

    // Add languages column (TEXT[])
    if (!(await columnExists('ugc_creators', 'languages'))) {
      await client.query(`ALTER TABLE ugc_creators ADD COLUMN languages TEXT[] DEFAULT '{}'`);
      console.log('  ✅ languages column added');
    } else {
      console.log('  ⏭️ languages column already exists');
    }

    // Add equipment column (TEXT[])
    if (!(await columnExists('ugc_creators', 'equipment'))) {
      await client.query(`ALTER TABLE ugc_creators ADD COLUMN equipment TEXT[] DEFAULT '{}'`);
      console.log('  ✅ equipment column added');
    } else {
      console.log('  ⏭️ equipment column already exists');
    }

    // Add availability column (JSONB)
    if (!(await columnExists('ugc_creators', 'availability'))) {
      await client.query(`ALTER TABLE ugc_creators ADD COLUMN availability JSONB DEFAULT '{}'`);
      console.log('  ✅ availability column added');
    } else {
      console.log('  ⏭️ availability column already exists');
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
