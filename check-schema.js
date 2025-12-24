require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log('Users table schema:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    const pushResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'push_subscriptions'
    `);
    console.log('\nPush subscriptions table schema:');
    console.log(JSON.stringify(pushResult.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

main();
