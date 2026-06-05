// Pawned MMO Game Server
// Real-time chat server with PostgreSQL database integration

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer')
const createChessRouter = require('./chess/chessRoutes')
const registerChessSockets = require('./chess/chessSockets')
const { createChessTables } = require('./chess/chessStore')
const { createDatabasePool } = require('./database')

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
const pool = createDatabasePool()

const sessions = new Map();
const verificationTokens = new Map()
const mailTransport = nodemailer.createTransport({
  sendmail: true,
  newline: 'unix',
  path: process.env.SENDMAIL_PATH || '/usr/sbin/sendmail',
})

const channelNameConflictError = 'Channel name is already taken'
const userSelectColumns = `
  id,
  username,
  email,
  is_admin,
  role,
  is_blocked,
  avatar_url,
  show_channel_presence,
  show_chess_opening
`

function isAdminUser(user) {
  return Boolean(user?.is_admin || user?.role === 'admin' || user?.role === 'developer')
}

function isModeratorUser(user) {
  return Boolean(isAdminUser(user) || user?.role === 'moderator')
}

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

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function getSession(token) {
  if (!token) {
    return null
  }

  const memorySession = sessions.get(token)

  if (memorySession) {
    return memorySession
  }

  const result = await pool.query(
    'SELECT user_id FROM auth_sessions WHERE token_hash = $1',
    [hashToken(token)]
  )
  const row = result.rows[0]

  if (!row) {
    return null
  }

  const session = { userId: row.user_id }
  sessions.set(token, session)
  return session
}

async function saveSession(token, userId) {
  sessions.set(token, { userId })
  await pool.query(
    `
      INSERT INTO auth_sessions (token_hash, user_id)
      VALUES ($1, $2)
      ON CONFLICT (token_hash) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          created_at = CURRENT_TIMESTAMP
    `,
    [hashToken(token), userId]
  )
}

async function deleteSession(token) {
  sessions.delete(token)
  await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)])
}

async function deleteUserSessions(userId) {
  for (const [token, session] of sessions.entries()) {
    if (Number(session.userId) === Number(userId)) {
      sessions.delete(token)
    }
  }

  await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId])
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

async function channelNameExists(name, excludedChannelId = null, client = pool) {
  const result = await client.query(
    `
      SELECT id
      FROM channels
      WHERE LOWER(name) = LOWER($1)
        AND ($2::integer IS NULL OR id <> $2::integer)
      LIMIT 1
    `,
    [name, excludedChannelId]
  )

  return result.rows.length > 0
}

function createVerificationToken() {
  return crypto.randomBytes(32).toString('hex')
}

function getVerificationLink(req, token) {
  return `${getPublicBaseUrl(req)}/verify-email?token=${token}`
}

function sendVerificationEmail(email, verificationLink) {
  return mailTransport.sendMail({
    from: process.env.MAIL_FROM || 'Pawned <no-reply@pawned.io>',
    to: email,
    subject: 'Verify your Pawned account',
    text: `Welcome to Pawned.\n\nVerify your email here:\n${verificationLink}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Welcome to Pawned.</p>
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

  try {
    const session = await getSession(token)

    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT ${userSelectColumns} FROM users WHERE id = $1 AND is_verified = true AND is_blocked = false`,
      [session.userId]
    );

    if (result.rows.length === 0) {
      await deleteSession(token);

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

async function optionalAuthenticate(req, res, next) {
  const token = getAuthToken(req)

  if (!token) {
    req.user = null
    next()
    return
  }

  try {
    const session = await getSession(token)

    if (!session) {
      req.user = null
      next()
      return
    }

    const result = await pool.query(
      `SELECT ${userSelectColumns} FROM users WHERE id = $1 AND is_verified = true AND is_blocked = false`,
      [session.userId]
    )

    req.user = result.rows[0] || null
    req.authToken = token
    next()
  } catch (err) {
    console.error('Error optionally authenticating user:', err)
    res.status(500).json({ error: 'Failed to authenticate user' })
  }
}

function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

function requireModerator(req, res, next) {
  if (!isModeratorUser(req.user)) {
    return res.status(403).json({ error: 'Moderator access required' })
  }

  next()
}

async function getChannelAccess(channelId, user) {
  const result = await pool.query(
    `
      SELECT c.*,
             u.username AS owner_username,
             cm.role AS membership_role,
             cm.status AS membership_status,
             cmr.status AS request_status
      FROM channels c
      LEFT JOIN users u ON u.id = c.owner_user_id
      LEFT JOIN channel_members cm
        ON cm.channel_id = c.id
       AND cm.user_id = $2
       AND cm.status = 'active'
      LEFT JOIN channel_membership_requests cmr
        ON cmr.channel_id = c.id
       AND cmr.user_id = $2
       AND cmr.status = 'pending'
      WHERE c.id = $1
    `,
    [channelId, user.id]
  )
  const channel = result.rows[0]

  if (!channel) {
    return null
  }

  const isOwner = Number(channel.owner_user_id) === Number(user.id)
  const isMember = Boolean(channel.membership_status)
  const canManage = Boolean(isAdminUser(user) || isOwner)
  const canAccess = Boolean(isAdminUser(user) || !channel.is_private || isOwner || isMember)

  return {
    channel,
    isOwner,
    isMember,
    canManage,
    canAccess,
    requestStatus: channel.request_status || null,
  }
}

async function requireChannelAccess(req, res, next) {
  try {
    const access = await getChannelAccess(req.params.id, req.user)

    if (!access) {
      return res.status(404).json({ error: 'Channel not found' })
    }

    if (!access.canAccess) {
      return res.status(403).json({ error: 'Membership required' })
    }

    req.channelAccess = access
    next()
  } catch (err) {
    console.error('Error checking channel access:', err)
    res.status(500).json({ error: 'Failed to check channel access' })
  }
}

async function requireChannelManager(req, res, next) {
  try {
    const access = await getChannelAccess(req.params.id, req.user)

    if (!access) {
      return res.status(404).json({ error: 'Channel not found' })
    }

    if (!access.canManage) {
      return res.status(403).json({ error: 'Channel owner access required' })
    }

    req.channelAccess = access
    next()
  } catch (err) {
    console.error('Error checking channel manager:', err)
    res.status(500).json({ error: 'Failed to check channel manager' })
  }
}

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
    console.error('Please ensure PostgreSQL is running and the database "pawned" exists.');
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

app.use('/api/chess', createChessRouter({ pool, authenticate, optionalAuthenticate, io }))

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
               role,
               is_blocked,
               is_verified,
               email,
               avatar_url,
               show_channel_presence,
               show_chess_opening,
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

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Account blocked' })
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
    await saveSession(token, user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        role: user.role,
        is_blocked: user.is_blocked,
        avatar_url: user.avatar_url,
        show_channel_presence: user.show_channel_presence,
        show_chess_opening: user.show_chess_opening,
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
          is_verified
        )
        VALUES ($1, $2, $3, true)
      `,
      [email, username, `sha256:${hashPassword(password)}`]
    )

    res.status(201).json({
      message: 'Account created. You can sign in now.',
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

app.post('/api/auth/logout', authenticate, async (req, res) => {
  await deleteSession(req.authToken);
  res.json({ message: 'Logged out' });
});

app.put('/api/auth/settings', authenticate, async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : ''
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : ''
  const confirmNewPassword = typeof req.body.confirmNewPassword === 'string' ? req.body.confirmNewPassword : ''
  const avatarUrl = normalizeAvatarUrl(req.body.avatarUrl)
  const showChannelPresence = req.body.showChannelPresence !== false
  const showChessOpening = req.body.showChessOpening !== false

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
            avatar_url = $3,
            show_channel_presence = $4,
            show_chess_opening = $5
        WHERE id = $6
        RETURNING id, username, email, is_admin, role, is_blocked, avatar_url, show_channel_presence, show_chess_opening
      `,
      [email, passwordHash, avatarUrl, showChannelPresence, showChessOpening, req.user.id]
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

app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT id,
               username,
               email,
               is_admin,
               role,
               is_blocked,
               is_verified,
               avatar_url,
               created_at
        FROM users
        ORDER BY is_blocked ASC,
                 CASE role WHEN 'admin' THEN 0 WHEN 'developer' THEN 1 WHEN 'moderator' THEN 2 WHEN 'vip' THEN 3 ELSE 4 END,
                 LOWER(username) ASC
      `
    )

    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching users:', err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

app.put('/api/users/:id/role', authenticate, requireAdmin, async (req, res) => {
  const role = typeof req.body.role === 'string' ? req.body.role.trim().toLowerCase() : ''

  if (!['user', 'vip', 'developer', 'moderator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be user, vip, developer, moderator, or admin' })
  }

  if (Number(req.params.id) === Number(req.user.id) && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin role' })
  }

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET role = $1,
            is_admin = $2
        WHERE id = $3
        RETURNING id, username, email, is_admin, role, is_blocked, is_verified, avatar_url, created_at
      `,
      [role, role === 'admin' || role === 'developer', req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    io.to(`user:${req.params.id}`).emit('userUpdated', result.rows[0])
    res.json({ user: result.rows[0], message: 'Role updated' })
  } catch (err) {
    console.error('Error updating user role:', err)
    res.status(500).json({ error: 'Failed to update user role' })
  }
})

app.put('/api/users/:id/block', authenticate, requireModerator, async (req, res) => {
  const blocked = req.body.blocked !== false

  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(400).json({ error: 'You cannot block yourself' })
  }

  try {
    const targetResult = await pool.query(
      'SELECT id, role, is_admin FROM users WHERE id = $1',
      [req.params.id]
    )
    const target = targetResult.rows[0]

    if (!target) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!isAdminUser(req.user) && isModeratorUser(target)) {
      return res.status(403).json({ error: 'Moderators can only block regular users' })
    }

    const result = await pool.query(
      `
        UPDATE users
        SET is_blocked = $1
        WHERE id = $2
        RETURNING id, username, email, is_admin, role, is_blocked, is_verified, avatar_url, created_at
      `,
      [blocked, req.params.id]
    )

    if (blocked) {
      await deleteUserSessions(req.params.id)
    }

    io.to(`user:${req.params.id}`).emit('userUpdated', result.rows[0])
    res.json({ user: result.rows[0], message: blocked ? 'User blocked' : 'User unblocked' })
  } catch (err) {
    console.error('Error updating user block:', err)
    res.status(500).json({ error: 'Failed to update user block' })
  }
})

app.delete('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(400).json({ error: 'You cannot delete your own account here' })
  }

  try {
    await deleteUserSessions(req.params.id)

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username',
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    io.to(`user:${req.params.id}`).emit('userDeleted')
    res.json({ message: 'User deleted', user: result.rows[0] })
  } catch (err) {
    console.error('Error deleting user:', err)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

// Get all channels
app.get('/api/channels', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT c.*,
               u.username AS owner_username,
               cm.role AS membership_role,
               cm.status AS membership_status,
               cmr.status AS request_status,
               COALESCE(pending.pending_request_count, 0)::int AS pending_request_count
        FROM channels c
        LEFT JOIN users u ON u.id = c.owner_user_id
        LEFT JOIN channel_members cm
          ON cm.channel_id = c.id
         AND cm.user_id = $1
         AND cm.status = 'active'
        LEFT JOIN channel_membership_requests cmr
          ON cmr.channel_id = c.id
         AND cmr.user_id = $1
         AND cmr.status = 'pending'
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS pending_request_count
          FROM channel_membership_requests requests
          WHERE requests.channel_id = c.id
            AND requests.status = 'pending'
        ) pending ON true
        ORDER BY c.created_at DESC
      `,
      [req.user.id]
    )

    res.json(result.rows.map((channel) => {
      const isOwner = Number(channel.owner_user_id) === Number(req.user.id)
      const canManage = Boolean(isAdminUser(req.user) || isOwner)
      const canAccess = Boolean(
        isAdminUser(req.user) ||
        !channel.is_private ||
        isOwner ||
        channel.membership_status === 'active'
      )

      return {
        ...channel,
        membership_status: channel.membership_status || null,
        request_status: channel.request_status || null,
        can_manage: canManage,
        can_access: canAccess,
        pending_request_count: canManage ? channel.pending_request_count : 0,
      }
    }))
  } catch (err) {
    console.error('Error fetching channels:', err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Create a new channel
app.post('/api/channels', authenticate, async (req, res) => {
  const { name, description, is_private, is_read_only } = req.body
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  const privateChannel = isAdminUser(req.user) ? Boolean(is_private) : true
  const readOnlyChannel = isAdminUser(req.user) ? Boolean(is_read_only) : false

  if (!trimmedName) {
    return res.status(400).json({ error: 'Channel name is required' });
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    if (await channelNameExists(trimmedName, null, client)) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: channelNameConflictError })
    }

    const channelResult = await client.query(
      'INSERT INTO channels (name, description, is_private, is_read_only, owner_user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [trimmedName, description || null, privateChannel, readOnlyChannel, req.user.id]
    )
    const channel = channelResult.rows[0]

    if (privateChannel) {
      await client.query(
        `
          INSERT INTO channel_members (channel_id, user_id, role, status)
          VALUES ($1, $2, 'owner', 'active')
          ON CONFLICT (channel_id, user_id) DO UPDATE
          SET role = 'owner',
              status = 'active',
              updated_at = CURRENT_TIMESTAMP
        `,
        [channel.id, req.user.id]
      )
    }

    await client.query('COMMIT')
    res.status(201).json({
      ...channel,
      owner_username: req.user.username,
      membership_role: privateChannel ? 'owner' : null,
      membership_status: privateChannel ? 'active' : null,
      request_status: null,
      can_manage: true,
      can_access: true,
      pending_request_count: 0,
    });
    
    // Notify all clients about the new channel
    io.emit('channelCreated', {
      ...channel,
      owner_username: req.user.username,
      membership_role: null,
      membership_status: null,
      request_status: null,
      can_manage: false,
      can_access: !privateChannel,
      pending_request_count: 0,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err.code === '23505') {
      return res.status(409).json({ error: channelNameConflictError })
    }

    console.error('Error creating channel:', err);
    res.status(500).json({ error: 'Failed to create channel' });
  } finally {
    client.release()
  }
});

// Update a channel
app.put('/api/channels/:id', authenticate, requireChannelManager, async (req, res) => {
  const { id } = req.params
  const { name, description, is_private, is_read_only } = req.body
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  const privateChannel = isAdminUser(req.user) ? Boolean(is_private) : true
  const readOnlyChannel = isAdminUser(req.user)
    ? Boolean(is_read_only)
    : Boolean(req.channelAccess.channel.is_read_only)

  if (!trimmedName) {
    return res.status(400).json({ error: 'Channel name is required' });
  }
  
  try {
    if (await channelNameExists(trimmedName, id)) {
      return res.status(409).json({ error: channelNameConflictError })
    }

    const result = await pool.query(
      'UPDATE channels SET name = $1, description = $2, is_private = $3, is_read_only = $4 WHERE id = $5 RETURNING *',
      [trimmedName, description || null, privateChannel, readOnlyChannel, id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    res.json(result.rows[0]);
    
    // Notify all clients about the updated channel
    io.emit('channelUpdated', result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: channelNameConflictError })
    }

    console.error('Error updating channel:', err);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// Delete a channel
app.delete('/api/channels/:id', authenticate, requireChannelManager, async (req, res) => {
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

app.post('/api/channels/:id/membership-requests', authenticate, async (req, res) => {
  const { id } = req.params

  try {
    const access = await getChannelAccess(id, req.user)

    if (!access) {
      return res.status(404).json({ error: 'Channel not found' })
    }

    if (!access.channel.is_private) {
      return res.status(400).json({ error: 'Public channels do not need membership' })
    }

    if (access.canAccess) {
      return res.status(400).json({ error: 'You are already a member' })
    }

    const result = await pool.query(
      `
        INSERT INTO channel_membership_requests (channel_id, user_id, status)
        VALUES ($1, $2, 'pending')
        ON CONFLICT (channel_id, user_id) DO UPDATE
        SET updated_at = CURRENT_TIMESTAMP,
            status = 'pending'
        RETURNING *
      `,
      [id, req.user.id]
    )

    const request = result.rows[0]
    const payload = {
      ...request,
      username: req.user.username,
      channel_name: access.channel.name,
    }

    const target = access.channel.owner_user_id
      ? io.to(`user:${access.channel.owner_user_id}`).to('admins')
      : io.to('admins')

    target.emit('membershipRequestCreated', payload)

    res.status(201).json(payload)
  } catch (err) {
    console.error('Error creating membership request:', err)
    res.status(500).json({ error: 'Failed to request membership' })
  }
})

app.get('/api/channels/:id/members', authenticate, requireChannelManager, async (req, res) => {
  const { id } = req.params

  try {
    const result = await pool.query(
      `
        SELECT cm.id,
               cm.channel_id,
               cm.user_id,
               cm.role,
               cm.status,
               cm.created_at,
               u.username,
               u.avatar_url
        FROM channel_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.channel_id = $1
          AND cm.status = 'active'
        ORDER BY
          CASE cm.role WHEN 'owner' THEN 0 ELSE 1 END,
          u.username ASC
      `,
      [id]
    )

    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching channel members:', err)
    res.status(500).json({ error: 'Failed to fetch members' })
  }
})

app.delete('/api/channels/:id/members/:userId', authenticate, requireChannelManager, async (req, res) => {
  const { id, userId } = req.params

  if (Number(userId) === Number(req.channelAccess.channel.owner_user_id)) {
    return res.status(400).json({ error: 'Owner cannot be removed' })
  }

  try {
    await pool.query(
      'DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [id, userId]
    )

    io.to(`user:${userId}`).emit('channelMembershipRemoved', { channel_id: Number(id) })
    res.json({ message: 'Member removed' })
  } catch (err) {
    console.error('Error removing channel member:', err)
    res.status(500).json({ error: 'Failed to remove member' })
  }
})

app.get('/api/channels/:id/membership-requests', authenticate, requireChannelManager, async (req, res) => {
  const { id } = req.params

  try {
    const result = await pool.query(
      `
        SELECT cmr.id,
               cmr.channel_id,
               cmr.user_id,
               cmr.status,
               cmr.created_at,
               cmr.updated_at,
               u.username,
               u.avatar_url
        FROM channel_membership_requests cmr
        JOIN users u ON u.id = cmr.user_id
        WHERE cmr.channel_id = $1
          AND cmr.status = 'pending'
        ORDER BY cmr.created_at ASC
      `,
      [id]
    )

    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching membership requests:', err)
    res.status(500).json({ error: 'Failed to fetch membership requests' })
  }
})

app.post('/api/channels/:id/membership-requests/:requestId/:action', authenticate, requireChannelManager, async (req, res) => {
  const { id, requestId, action } = req.params

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Unknown membership action' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const requestResult = await client.query(
      `
        UPDATE channel_membership_requests
        SET status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
          AND channel_id = $3
          AND status = 'pending'
        RETURNING *
      `,
      [action === 'approve' ? 'approved' : 'rejected', requestId, id]
    )
    const request = requestResult.rows[0]

    if (!request) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Membership request not found' })
    }

    if (action === 'approve') {
      await client.query(
        `
          INSERT INTO channel_members (channel_id, user_id, role, status)
          VALUES ($1, $2, 'member', 'active')
          ON CONFLICT (channel_id, user_id) DO UPDATE
          SET role = CASE WHEN channel_members.role = 'owner' THEN 'owner' ELSE 'member' END,
              status = 'active',
              updated_at = CURRENT_TIMESTAMP
        `,
        [id, request.user_id]
      )
    }

    await client.query('COMMIT')
    io.to(`user:${request.user_id}`).emit('membershipRequestUpdated', {
      channel_id: Number(id),
      status: action === 'approve' ? 'approved' : 'rejected',
    })
    res.json({ message: action === 'approve' ? 'Member approved' : 'Request rejected' })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Error updating membership request:', err)
    res.status(500).json({ error: 'Failed to update membership request' })
  } finally {
    client.release()
  }
})

// Get messages for a specific channel
app.get('/api/channels/:id/messages', authenticate, requireChannelAccess, async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const result = await pool.query(
      'SELECT m.*, u.username, u.avatar_url, u.is_admin, u.role, u.is_blocked FROM messages m JOIN users u ON m.user_id = u.id WHERE m.channel_id = $1 ORDER BY m.created_at DESC LIMIT $2',
      [id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.delete('/api/messages/:id', authenticate, async (req, res) => {
  const { id } = req.params

  try {
    const messageResult = await pool.query(
      'SELECT id, channel_id, user_id FROM messages WHERE id = $1',
      [id]
    )
    const message = messageResult.rows[0]

    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }

    if (message.user_id !== req.user.id && !isModeratorUser(req.user)) {
      return res.status(403).json({ error: 'You can only delete your own messages' })
    }

    await pool.query('DELETE FROM messages WHERE id = $1', [id])

    io.to(String(message.channel_id)).emit('messageDeleted', {
      id: message.id,
      channel_id: message.channel_id,
    })

    res.json({ message: 'Message deleted' })
  } catch (err) {
    console.error('Error deleting message:', err)
    res.status(500).json({ error: 'Failed to delete message' })
  }
})

async function getUserFromToken(token) {
  const session = await getSession(token)

  if (!session) {
    return null
  }

  const result = await pool.query(
    `SELECT ${userSelectColumns} FROM users WHERE id = $1 AND is_verified = true AND is_blocked = false`,
    [session.userId]
  )

  return result.rows[0] || null
}

async function refreshSocketUser(socket) {
  const result = await pool.query(
    `SELECT ${userSelectColumns} FROM users WHERE id = $1 AND is_verified = true AND is_blocked = false`,
    [socket.data.user.id]
  )
  const user = result.rows[0]

  if (!user) {
    socket.emit('chatError', 'Account blocked')
    socket.disconnect(true)
    return null
  }

  socket.data.user = user
  if (isAdminUser(user)) {
    socket.join('admins')
  } else {
    socket.leave('admins')
  }
  return user
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
  socket.data.channelIds = new Set()
  socket.join(`user:${user.id}`)

  if (isAdminUser(user)) {
    socket.join('admins')
  }

  registerChessSockets(io, socket, { pool })
  
  // Join a channel
  socket.on('joinChannel', async (channelId, callback) => {
    try {
      const liveUser = await refreshSocketUser(socket)

      if (!liveUser) {
        callback?.({ error: 'Account blocked' })
        return
      }

      const access = await getChannelAccess(channelId, socket.data.user)

      if (!access || !access.canAccess) {
        callback?.({ error: 'Membership required' })
        return
      }

      if (socket.data.channelIds.has(String(channelId))) {
        callback?.({ ok: true })
        return
      }

      socket.join(String(channelId))
      socket.data.channelIds.add(String(channelId))
      io.to(String(channelId)).emit('channelPresence', {
        id: `presence-${Date.now()}-${socket.id}-join-${channelId}`,
        channel_id: Number(channelId),
        username: socket.data.user.username,
        type: 'join',
        created_at: new Date().toISOString(),
      })
      callback?.({ ok: true })
      console.log(`User ${socket.id} joined channel ${channelId}`)
    } catch (err) {
      console.error('Error joining channel:', err)
      callback?.({ error: 'Failed to join channel' })
    }
  })
  
  // Leave a channel
  socket.on('leaveChannel', (channelId) => {
    if (socket.data.channelIds.has(String(channelId))) {
      io.to(String(channelId)).emit('channelPresence', {
        id: `presence-${Date.now()}-${socket.id}-leave-${channelId}`,
        channel_id: Number(channelId),
        username: socket.data.user.username,
        type: 'leave',
        created_at: new Date().toISOString(),
      })
      socket.data.channelIds.delete(String(channelId))
    }

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
      const liveUser = await refreshSocketUser(socket)

      if (!liveUser) {
        callback?.({ error: 'Account blocked' })
        return
      }

      const access = await getChannelAccess(channelId, socket.data.user)

      if (!access) {
        callback?.({ error: 'Channel not found' })
        return
      }

      if (!access.canAccess) {
        callback?.({ error: 'Membership required' })
        return
      }

      if (access.channel.is_read_only && !isAdminUser(socket.data.user)) {
        callback?.({ error: 'Channel is read only' })
        return
      }

      const chessChatResult = await pool.query(
        'SELECT id FROM chess_games WHERE chat_channel_id = $1 AND chat_closed_at IS NOT NULL LIMIT 1',
        [channelId]
      )

      if (chessChatResult.rows.length > 0) {
        callback?.({ error: 'Game chat is closed' })
        return
      }

      // Insert message into database
      const result = await pool.query(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
        [channelId, socket.data.user.id, trimmedMessage]
      )
      
      const messageData = result.rows[0]
      const messageResult = await pool.query(
        'SELECT m.*, u.username, u.avatar_url, u.is_admin, u.role, u.is_blocked FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = $1',
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
    for (const channelId of socket.data.channelIds || []) {
      io.to(channelId).emit('channelPresence', {
        id: `presence-${Date.now()}-${socket.id}-leave-${channelId}`,
        channel_id: Number(channelId),
        username: socket.data.user.username,
        type: 'leave',
        created_at: new Date().toISOString(),
      })
    }

    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Pawned server running on port ${PORT}`);
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
        is_read_only BOOLEAN DEFAULT FALSE,
        owner_user_id INTEGER,
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
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        is_blocked BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT TRUE,
        verification_token TEXT UNIQUE,
        verification_token_expires_at TIMESTAMP,
        verified_at TIMESTAMP,
        avatar_url TEXT,
        show_channel_presence BOOLEAN DEFAULT TRUE,
        show_chess_opening BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE');
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'");
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT UNIQUE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS show_channel_presence BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS show_chess_opening BOOLEAN DEFAULT TRUE');
    await pool.query('UPDATE users SET is_verified = true WHERE is_verified IS NULL');
    await pool.query("UPDATE users SET role = 'user' WHERE role IS NULL OR role NOT IN ('user', 'vip', 'developer', 'moderator', 'admin')");
    await pool.query("UPDATE users SET role = 'admin' WHERE is_admin = true AND role = 'user'");
    await pool.query("UPDATE users SET is_admin = false WHERE role NOT IN ('admin', 'developer')");
    await pool.query("UPDATE users SET is_admin = true WHERE role IN ('admin', 'developer')");
    await pool.query('UPDATE users SET is_blocked = false WHERE is_blocked IS NULL');
    await pool.query('UPDATE users SET show_channel_presence = true WHERE show_channel_presence IS NULL');
    await pool.query('UPDATE users SET show_chess_opening = true WHERE show_chess_opening IS NULL');
    await pool.query('ALTER TABLE channels ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_read_only BOOLEAN DEFAULT FALSE')
    await pool.query('UPDATE channels SET is_read_only = false WHERE is_read_only IS NULL')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const defaultAdminPasswordHash = `sha256:${hashPassword(process.env.DEFAULT_ADMIN_PASSWORD || 'admin')}`;

    await pool.query(
      `
        INSERT INTO users (username, password_hash, is_admin, role)
        VALUES ('Admin', $1, true, 'admin')
        ON CONFLICT (username) DO UPDATE
        SET password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash),
            is_admin = true,
            role = 'admin'
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
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS channel_membership_requests (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel_id, user_id)
      )
    `);

    await pool.query(`
      INSERT INTO channel_members (channel_id, user_id, role, status)
      SELECT c.id, c.owner_user_id, 'owner', 'active'
      FROM channels c
      WHERE c.is_private = true
        AND c.owner_user_id IS NOT NULL
      ON CONFLICT (channel_id, user_id) DO NOTHING
    `);
    
    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name)');
    await pool.query(`
      WITH duplicate_channels AS (
        SELECT id,
               name,
               ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY id) AS duplicate_rank
        FROM channels
      )
      UPDATE channels c
      SET name = LEFT(c.name, 90) || '-' || c.id
      FROM duplicate_channels d
      WHERE c.id = d.id
        AND d.duplicate_rank > 1
    `);
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_lower_name_unique ON channels(LOWER(name))');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_membership_requests_channel_id ON channel_membership_requests(channel_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_membership_requests_user_id ON channel_membership_requests(user_id)');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_requests_channel_user ON channel_membership_requests(channel_id, user_id)');
    await createChessTables(pool)
    
    console.log('Database tables created successfully');
  } catch (err) {
    console.error('Error creating database tables:', err);
  }
}

// Initialize database tables
createTables();

module.exports = { app, server, io, pool };
