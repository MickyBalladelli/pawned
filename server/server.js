// Vela MMO Game Server
// Real-time chat server with PostgreSQL database integration

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const path = require('path');

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
app.use(express.static(path.join(__dirname, '../client/build')));

// Middleware for parsing JSON
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
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
app.post('/api/channels', async (req, res) => {
  const { name, description, is_private } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO channels (name, description, is_private) VALUES ($1, $2, $3) RETURNING *',
      [name, description, is_private || false]
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
app.put('/api/channels/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, is_private } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE channels SET name = $1, description = $2, is_private = $3 WHERE id = $4 RETURNING *',
      [name, description, is_private, id]
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
app.delete('/api/channels/:id', async (req, res) => {
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