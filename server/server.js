// Vela MMO Game Server
// Real-time chat server with PostgreSQL database integration

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// PostgreSQL connection pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'vela',
  password: 'postgres',
  port: 5432,
});

const sessions = new Map();

function getAuthToken(req) {
  const header = req.get('Authorization') || '';

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim();
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function passwordMatches(password, passwordHash) {
  if (!passwordHash) {
    return true;
  }

  if (!password) {
    return false;
  }

  if (passwordHash.startsWith('sha256:')) {
    return hashPassword(password) === passwordHash.slice('sha256:'.length);
  }

  return password === passwordHash || hashPassword(password) === passwordHash;
}

async function authenticate(req, res, next) {
  const token = getAuthToken(req);
  const session = token ? sessions.get(token) : null;

  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, is_admin FROM users WHERE id = $1',
      [session.userId]
    );

    if (result.rows.length === 0) {
      sessions.delete(token);
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = result.rows[0];
    req.authToken = token;
    next();
  } catch (err) {
    console.error('Error authenticating user:', err);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
    console.error('Please ensure PostgreSQL is running and the database "vela" exists.');
    console.error('You may need to run: ./scripts/init-db.sh');
  } else {
    console.log('Database connected successfully');
  }
});

// Serve static files from client build directory
app.use(express.static(path.join(__dirname, '../client/dist')));

// Middleware for parsing JSON
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash, is_admin FROM users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );

    const user = result.rows[0];

    if (!user || !passwordMatches(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
      },
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  sessions.delete(req.authToken);
  res.json({ message: 'Logged out' });
});

// Get all channels
app.get('/api/channels', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM channels ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching channels:', err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Create a new channel
app.post('/api/channels', authenticate, requireAdmin, async (req, res) => {
  const { name, description, is_private } = req.body;
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!trimmedName) {
    return res.status(400).json({ error: 'Channel name is required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO channels (name, description, is_private) VALUES ($1, $2, $3) RETURNING *',
      [trimmedName, description || null, Boolean(is_private)]
    );
    res.status(201).json(result.rows[0]);
    
    // Notify all clients about the new channel
    io.emit('channelCreated', result.rows[0]);
  } catch (err) {
    console.error('Error creating channel:', err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Update a channel
app.put('/api/channels/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, is_private } = req.body;
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!trimmedName) {
    return res.status(400).json({ error: 'Channel name is required' });
  }
  
  try {
    const result = await pool.query(
      'UPDATE channels SET name = $1, description = $2, is_private = $3 WHERE id = $4 RETURNING *',
      [trimmedName, description || null, Boolean(is_private), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    res.json(result.rows[0]);
    
    // Notify all clients about the updated channel
    io.emit('channelUpdated', result.rows[0]);
  } catch (err) {
    console.error('Error updating channel:', err);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// Delete a channel
app.delete('/api/channels/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM channels WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    res.json({ message: 'Channel deleted successfully' });
    
    // Notify all clients about the deleted channel
    io.emit('channelDeleted', id);
  } catch (err) {
    console.error('Error deleting channel:', err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// Get messages for a specific channel
app.get('/api/channels/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const result = await pool.query(
      'SELECT m.*, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.channel_id = $1 ORDER BY m.created_at DESC LIMIT $2',
      [id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join a channel
  socket.on('joinChannel', (channelId) => {
    socket.join(channelId);
    console.log(`User ${socket.id} joined channel ${channelId}`);
  });
  
  // Leave a channel
  socket.on('leaveChannel', (channelId) => {
    socket.leave(channelId);
    console.log(`User ${socket.id} left channel ${channelId}`);
  });
  
  // Send a message to a channel
  socket.on('sendMessage', async (data) => {
    const { channelId, userId, message } = data;
    
    try {
      // Insert message into database
      const result = await pool.query(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
        [channelId, userId, message]
      );
      
      const messageData = result.rows[0];
      
      // Fetch user details for the message
      const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];
      
      // Emit the message to the channel
      const messageWithUser = {
        ...messageData,
        username: user.username
      };
      
      io.to(channelId).emit('receiveMessage', messageWithUser);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  });
  
  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Vela server running on port ${PORT}`);
});

// Create database tables if they don't exist
async function createTables() {
  try {
    // Create channels table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        is_private BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const defaultAdminPasswordHash = `sha256:${hashPassword(process.env.DEFAULT_ADMIN_PASSWORD || 'admin')}`;

    await pool.query(
      `
        INSERT INTO users (username, password_hash, is_admin)
        VALUES ('Admin', $1, true)
        ON CONFLICT (username) DO UPDATE
        SET password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash)
      `,
      [defaultAdminPasswordHash]
    );
    
    // Create messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name)');
    
    console.log('Database tables created successfully');
  } catch (err) {
    console.error('Error creating database tables:', err);
  }
}

// Initialize database tables
createTables();

module.exports = { app, server, io, pool };
