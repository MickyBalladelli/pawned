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

function hashPassword(password) {
  return require('crypto').createHash('sha256').update(password).digest('hex');
}

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
        owner_user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT TRUE,
        verification_token TEXT UNIQUE,
        verification_token_expires_at TIMESTAMP,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE')
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE')
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT UNIQUE')
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP')
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP')
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT')
    await pool.query('UPDATE users SET is_verified = true WHERE is_verified IS NULL')
    await pool.query('ALTER TABLE channels ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL')
    
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_members (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel_id, user_id)
      );
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_membership_requests (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel_id, user_id)
      );
    `)
    
    // Create sample users
    const defaultAdminPasswordHash = `sha256:${hashPassword(process.env.DEFAULT_ADMIN_PASSWORD || 'admin')}`;

    await pool.query(
      `
        INSERT INTO users (username, password_hash, is_admin) VALUES
        ('Admin', $1, true),
        ('Player1', NULL, false),
        ('Player2', NULL, false),
        ('Player3', NULL, false)
        ON CONFLICT (username) DO UPDATE
        SET password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash);
      `,
      [defaultAdminPasswordHash]
    );
    
    // Create sample channels
    await pool.query(`
      INSERT INTO channels (name, description, is_private) VALUES 
      ('General', 'General discussion about the game', false),
      ('Guilds', 'Guild related discussions', false),
      ('Events', 'Game events and announcements', false),
      ('Private1', 'A private channel', true)
      ON CONFLICT (name) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO channel_members (channel_id, user_id, role, status)
      SELECT c.id, c.owner_user_id, 'owner', 'active'
      FROM channels c
      WHERE c.is_private = true
        AND c.owner_user_id IS NOT NULL
      ON CONFLICT (channel_id, user_id) DO NOTHING;
    `)
    
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

    await pool.query('CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_membership_requests_channel_id ON channel_membership_requests(channel_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_membership_requests_user_id ON channel_membership_requests(user_id)')
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_requests_channel_user ON channel_membership_requests(channel_id, user_id)')
    
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
