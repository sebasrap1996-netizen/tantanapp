import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: 'config.env' });

async function assignAdminCredits() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Listar tablas disponibles
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log('📋 Tablas disponibles:', tables.rows.map(r => r.table_name).join(', '));
    
    // Buscar el usuario admin
    const result = await pool.query('SELECT id, email, "creditsBalance" FROM users WHERE email = $1', ['admin@aviator.com']);
    
    if (result.rows.length === 0) {
      console.log('❌ Usuario admin no encontrado');
      return;
    }
    
    const admin = result.rows[0];
    console.log(`👤 Usuario encontrado: ${admin.email}`);
    console.log(`💰 Balance actual: ${admin.creditsBalance}`);
    
    // Asignar 100 créditos
    await pool.query(
      'UPDATE users SET "creditsBalance" = $1, "creditsTotalEarned" = COALESCE("creditsTotalEarned", 0) + 100 WHERE id = $2',
      [125, admin.id]
    );
    
    console.log(`✅ Créditos asignados! Nuevo balance: 100`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

assignAdminCredits().catch(console.error);
