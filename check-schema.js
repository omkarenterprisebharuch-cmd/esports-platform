require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    // Check tables for the migration
    const tables = ['tournament_leaderboard', 'tournament_registrations', 'notifications', 'refresh_tokens'];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`\n${table} columns:`);
      if (result.rows.length === 0) {
        console.log('  Table does not exist!');
      } else {
        console.log('  ' + result.rows.map(x => x.column_name).join(', '));
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

main();
