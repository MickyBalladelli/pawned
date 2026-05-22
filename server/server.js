// Vela MMO Game Server
// Real-time chat server with PostgreSQL database integration

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer')

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
const verificationTokens = new Map()
const mailTransport = nodemailer.createTransport({
  sendmail: true,
  newline: 'unix',
  path: process.env.SENDMAIL_PATH || '/usr/sbin/sendmail',
})

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

function getPublicBaseUrl(req) {
  return process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim() : ''
}

function normalizeAvatarUrl(avatarUrl) {
  const value = typeof avatarUrl === 'string' ? avatarUrl.trim() : ''

  if (!value) {
    return null
  }

  if (!/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)) {
    return undefined
  }

  return value.length <= 1500000 ? value : undefined
}

function createVerificationToken() {
  return crypto.randomBytes(32).toString('hex')
}

function getVerificationLink(req, token) {
  return `${getPublicBaseUrl(req)}/verify-email?token=${token}`
}

function sendVerificationEmail(email, verificationLink) {
  return mailTransport.sendMail({
    from: process.env.MAIL_FROM || 'Vela <no-reply@vela.io>',
    to: email,
    subject: 'Verify your Vela account',
    text: `Welcome to Vela.\n\nVerify your email here:\n${verificationLink}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Welcome to Vela.</p>
      <p><a href="${verificationLink}">Verify your email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  }).then(() => {
    console.log(`Verification email sent to ${email}`)
  }).catch((err) => {
    console.error(`Error sending verification email to ${email}:`, err)
  })
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
      'SELECT id, username, email, is_admin, avatar_url FROM users WHERE id = $1 AND is_verified = true',
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
app.use(express.json({ limit: '2mb' }));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'))
})

app.get('/verify-email', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const result = await pool.query(
      `
        SELECT id,
               username,
               password_hash,
               is_admin,
               is_verified,
               email,
               avatar_url,
               verification_token,
               verification_token_expires_at
        FROM users
        WHERE LOWER(username) = LOWER($1)
      `,
      [username.trim()]
    );

    const user = result.rows[0];

    if (!user || !passwordMatches(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.is_verified) {
      let verificationToken = user.verification_token
      let verificationTokenExpiresAt = user.verification_token_expires_at

      if (!verificationToken || !verificationTokenExpiresAt || verificationTokenExpiresAt <= new Date()) {
        verificationToken = createVerificationToken()
        verificationTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)

        await pool.query(
          `
            UPDATE users
            SET verification_token = $1,
                verification_token_expires_at = $2
            WHERE id = $3
          `,
          [verificationToken, verificationTokenExpiresAt, user.id]
        )
      }

      verificationTokens.set(verificationToken, { email: user.email, expiresAt: verificationTokenExpiresAt })

      return res.status(403).json({
        error: 'Account pending approval. Verify your email first.',
        verificationLink: getVerificationLink(req, verificationToken),
      })
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

app.get('/api/auth/username-available', async (req, res) => {
  const username = normalizeUsername(req.query.username)

  if (!username) {
    return res.status(400).json({ error: 'Username is required' })
  }

  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    )

    res.json({ available: result.rows.length === 0 })
  } catch (err) {
    console.error('Error checking username:', err)
    res.status(500).json({ error: 'Failed to check username' })
  }
})

app.post('/api/auth/signup', async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const username = normalizeUsername(req.body.username)
  const { password, confirmPassword } = req.body

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' })
  }

  if (!username) {
    return res.status(400).json({ error: 'Username is required' })
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' })
  }

  const verificationToken = createVerificationToken()
  const verificationTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)

  try {
    const existing = await pool.query(
      'SELECT username, email FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [username, email]
    )

    if (existing.rows.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: 'Username is already taken' })
    }

    if (existing.rows.some((user) => user.email?.toLowerCase() === email)) {
      return res.status(409).json({ error: 'Email is already in use' })
    }

    await pool.query(
      `
        INSERT INTO users (
          email,
          username,
          password_hash,
          is_verified,
          verification_token,
          verification_token_expires_at
        )
        VALUES ($1, $2, $3, false, $4, $5)
      `,
      [email, username, `sha256:${hashPassword(password)}`, verificationToken, verificationTokenExpiresAt]
    )

    const verificationLink = getVerificationLink(req, verificationToken)
    verificationTokens.set(verificationToken, { email, expiresAt: verificationTokenExpiresAt })
    await sendVerificationEmail(email, verificationLink)

    res.status(201).json({
      message: 'Account pending approval. Check your email to verify.',
      verificationLink: process.env.NODE_ENV === 'production' ? undefined : verificationLink,
    })
  } catch (err) {
    console.error('Error signing up:', err)
    res.status(500).json({ error: 'Failed to sign up' })
  }
})

app.post('/api/auth/verify-email', async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token.trim() : ''

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' })
  }

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET is_verified = true,
            verified_at = CURRENT_TIMESTAMP,
            verification_token = NULL,
            verification_token_expires_at = NULL
        WHERE verification_token = $1
          AND is_verified = false
          AND verification_token_expires_at > CURRENT_TIMESTAMP
        RETURNING id, username
      `,
      [token]
    )

    verificationTokens.delete(token)

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Verification link is invalid or expired' })
    }

    res.json({ message: 'Email verified. You can log in now.' })
  } catch (err) {
    console.error('Error verifying email:', err)
    res.status(500).json({ error: 'Failed to verify email' })
  }
})

app.post('/api/auth/resend-verification', async (req, res) => {
  const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim() : normalizeEmail(req.body.email)

  if (!identifier) {
    return res.status(400).json({ error: 'Email or username is required' })
  }

  const verificationToken = createVerificationToken()
  const verificationTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET verification_token = $1,
            verification_token_expires_at = $2
        WHERE (LOWER(email) = LOWER($3) OR LOWER(username) = LOWER($3))
          AND is_verified = false
        RETURNING email
      `,
      [verificationToken, verificationTokenExpiresAt, identifier]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No unverified account found' })
    }

    const verificationLink = getVerificationLink(req, verificationToken)
    verificationTokens.set(verificationToken, { email: result.rows[0].email, expiresAt: verificationTokenExpiresAt })
    await sendVerificationEmail(result.rows[0].email, verificationLink)

    res.json({
      message: 'Verification email sent again.',
      verificationLink: process.env.NODE_ENV === 'production' ? undefined : verificationLink,
    })
  } catch (err) {
    console.error('Error resending verification email:', err)
    res.status(500).json({ error: 'Failed to resend verification email' })
  }
})

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  sessions.delete(req.authToken);
  res.json({ message: 'Logged out' });
});

app.put('/api/auth/settings', authenticate, async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : ''
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : ''
  const confirmNewPassword = typeof req.body.confirmNewPassword === 'string' ? req.body.confirmNewPassword : ''
  const avatarUrl = normalizeAvatarUrl(req.body.avatarUrl)

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' })
  }

  if (avatarUrl === undefined) {
    return res.status(400).json({ error: 'Picture must be a png, jpg, webp, or gif under 1.5 MB' })
  }

  if (newPassword && newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'New passwords do not match' })
  }

  try {
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    )
    const currentUser = userResult.rows[0]

    if (newPassword && !passwordMatches(currentPassword, currentUser.password_hash)) {
      return res.status(400).json({ error: 'Current password is wrong' })
    }

    const passwordHash = newPassword ? `sha256:${hashPassword(newPassword)}` : currentUser.password_hash
    const result = await pool.query(
      `
        UPDATE users
        SET email = $1,
            password_hash = $2,
            avatar_url = $3
        WHERE id = $4
        RETURNING id, username, email, is_admin, avatar_url
      `,
      [email, passwordHash, avatarUrl, req.user.id]
    )

    res.json({ user: result.rows[0], message: 'Settings saved' })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email is already in use' })
    }

    console.error('Error updating settings:', err)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

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
      'SELECT m.*, u.username, u.avatar_url FROM messages m JOIN users u ON m.user_id = u.id WHERE m.channel_id = $1 ORDER BY m.created_at DESC LIMIT $2',
      [id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

async function getUserFromToken(token) {
  const session = token ? sessions.get(token) : null

  if (!session) {
    return null
  }

  const result = await pool.query(
    'SELECT id, username, email, is_admin, avatar_url FROM users WHERE id = $1 AND is_verified = true',
    [session.userId]
  )

  return result.rows[0] || null
}

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('User connected:', socket.id)

  const token = socket.handshake.auth?.token
  const user = await getUserFromToken(token)

  if (!user) {
    socket.emit('chatError', 'Authentication required')
    socket.disconnect(true)
    return
  }

  socket.data.user = user
  
  // Join a channel
  socket.on('joinChannel', (channelId) => {
    socket.join(String(channelId))
    console.log(`User ${socket.id} joined channel ${channelId}`)
  })
  
  // Leave a channel
  socket.on('leaveChannel', (channelId) => {
    socket.leave(String(channelId))
    console.log(`User ${socket.id} left channel ${channelId}`)
  })
  
  // Send a message to a channel
  socket.on('sendMessage', async (data, callback) => {
    const { channelId, message } = data || {}
    const trimmedMessage = typeof message === 'string' ? message.trim() : ''

    if (!channelId || !trimmedMessage) {
      callback?.({ error: 'Message is required' })
      return
    }
    
    try {
      const channelResult = await pool.query('SELECT id FROM channels WHERE id = $1', [channelId])

      if (channelResult.rows.length === 0) {
        callback?.({ error: 'Channel not found' })
        return
      }

      // Insert message into database
      const result = await pool.query(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
        [channelId, socket.data.user.id, trimmedMessage]
      )
      
      const messageData = result.rows[0]
      const messageResult = await pool.query(
        'SELECT m.*, u.username, u.avatar_url FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = $1',
        [messageData.id]
      )
      const messageWithUser = messageResult.rows[0]
      
      io.to(String(channelId)).emit('receiveMessage', messageWithUser)
      callback?.({ message: messageWithUser })
    } catch (err) {
      console.error('Error sending message:', err)
      callback?.({ error: 'Failed to send message' })
    }
  })
  
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
        email VARCHAR(255) UNIQUE,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT TRUE,
        verification_token TEXT UNIQUE,
        verification_token_expires_at TIMESTAMP,
        verified_at TIMESTAMP,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT UNIQUE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    await pool.query('UPDATE users SET is_verified = true WHERE is_verified IS NULL');

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
