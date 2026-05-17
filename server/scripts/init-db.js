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
    // Test database connection
    await pool.query('SELECT 1');
    console.log('Connected to database successfully');
    
    // Create channels table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        is_private BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
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
      ('Private1', 'A private channel', true)
      ON CONFLICT (name) DO NOTHING;
    `);
    
    // Create sample messages
    await pool.query(`
      INSERT INTO messages (channel_id, user_id, content) VALUES 
      (1, 1, 'Welcome to the Vela MMO chat!'),
      (1, 2, 'Hello everyone!'),
      (1, 3, 'This is a test message'),
      (2, 1, 'Guild announcements will go here'),
      (3, 1, 'New event starting soon!')
      ON CONFLICT DO NOTHING;
    `);
    
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();