// Database initialization script for Vela MMO game
const { Pool } = require('pg');

// PostgreSQL connection pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'vela',
  password: 'postgres',
  port: 5432,
});

async function initializeDatabase() {
  try {
    // Create sample users
    await pool.query(`
      INSERT INTO users (username, is_admin) VALUES 
      ('Admin', true),
      ('Player1', false),
      ('Player2', false),
      ('Player3', false)
      ON CONFLICT (username) DO NOTHING;
    `);
    
    // Create sample channels
    await pool.query(`
      INSERT INTO channels (name, description, is_private) VALUES 
      ('General', 'General discussion about the game', false),
      ('Guilds', 'Guild related discussions', false),
      ('Events', 'Game events and announcements', false),
      ('Private1', 'Private channel for admins', true)
      ON CONFLICT (name) DO NOTHING;
    `);
    
    console.log('Database initialized with sample data');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    pool.end();
  }
}

initializeDatabase();