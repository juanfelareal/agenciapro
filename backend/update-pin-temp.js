// Temporary script to update PIN - DELETE AFTER USE
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updatePin() {
  try {
    const result = await pool.query(
      "UPDATE team_members SET pin = '5888' WHERE email = 'juanfe@larealmarketing.com' RETURNING id, email, name"
    );
    if (result.rows.length > 0) {
      console.log('✅ PIN actualizado para:', result.rows[0].name, '(' + result.rows[0].email + ')');
    } else {
      console.log('❌ Usuario no encontrado');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

updatePin();
