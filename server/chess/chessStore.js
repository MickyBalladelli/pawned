const { Chess } = require('chess.js')
const crypto = require('crypto')
const { normalizeBotLevel } = require('./chessBot')

const startingFen = new Chess().fen()
const chessBotUsername = 'VelaBot'

function normalizeColor(color) {
  return color === 'black' ? 'black' : 'white'
}

function oppositeColor(color) {
  return color === 'white' ? 'black' : 'white'
}

function colorForUser(game, userId) {
  if (Number(game.white_user_id) === Number(userId)) {
    return 'white'
  }

  if (Number(game.black_user_id) === Number(userId)) {
    return 'black'
  }

  return null
}

function currentTurnColor(fen) {
  return new Chess(fen).turn() === 'w' ? 'white' : 'black'
}

function statusFromChess(chess, fallbackStatus = 'active') {
  if (chess.isCheckmate()) {
    return 'checkmate'
  }

  if (chess.isDraw()) {
    return 'draw'
  }

  if (chess.isGameOver()) {
    return 'draw'
  }

  return fallbackStatus
}

function winnerFromChess(chess, game) {
  if (!chess.isCheckmate()) {
    return null
  }

  return chess.turn() === 'w' ? game.black_user_id : game.white_user_id
}

function mapGame(row) {
  if (!row) {
    return null
  }

  return {
    ...row,
    id: Number(row.id),
    white_user_id: row.white_user_id === null ? null : Number(row.white_user_id),
    black_user_id: row.black_user_id === null ? null : Number(row.black_user_id),
    winner_user_id: row.winner_user_id === null ? null : Number(row.winner_user_id),
    bot_level: row.bot_level === null || row.bot_level === undefined ? null : Number(row.bot_level),
    is_bot_game: Boolean(row.is_bot_game),
    turn_color: row.turn_color || currentTurnColor(row.fen),
  }
}

async function createChessTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chess_games (
      id SERIAL PRIMARY KEY,
      white_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      black_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      fen TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'waiting',
      turn_color VARCHAR(10) NOT NULL DEFAULT 'white',
      winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP,
      is_bot_game BOOLEAN DEFAULT FALSE,
      bot_level INTEGER
    )
  `)

  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS is_bot_game BOOLEAN DEFAULT FALSE')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS bot_level INTEGER')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chess_moves (
      id SERIAL PRIMARY KEY,
      game_id INTEGER REFERENCES chess_games(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      move_number INTEGER NOT NULL,
      color VARCHAR(10) NOT NULL,
      san TEXT NOT NULL,
      from_square VARCHAR(2) NOT NULL,
      to_square VARCHAR(2) NOT NULL,
      promotion VARCHAR(1),
      fen_after TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await pool.query('CREATE INDEX IF NOT EXISTS idx_chess_games_white_user_id ON chess_games(white_user_id)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_chess_games_black_user_id ON chess_games(black_user_id)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_chess_games_status ON chess_games(status)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_chess_games_is_bot_game ON chess_games(is_bot_game)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_chess_moves_game_id ON chess_moves(game_id)')
}

async function getChessBotUser(pool) {
  const passwordHash = `sha256:${crypto.randomBytes(32).toString('hex')}`
  const result = await pool.query(
    `
      INSERT INTO users (username, password_hash, is_admin, is_verified)
      VALUES ($1, $2, false, true)
      ON CONFLICT (username) DO UPDATE
      SET is_verified = true,
          password_hash = CASE
            WHEN users.password_hash IS NULL OR users.password_hash = 'bot' THEN EXCLUDED.password_hash
            ELSE users.password_hash
          END
      RETURNING id, username
    `,
    [chessBotUsername, passwordHash]
  )

  return result.rows[0]
}

async function getChessGame(pool, gameId, client = pool) {
  const result = await client.query(
    `
      SELECT g.*,
             wu.username AS white_username,
             bu.username AS black_username,
             win.username AS winner_username
      FROM chess_games g
      LEFT JOIN users wu ON wu.id = g.white_user_id
      LEFT JOIN users bu ON bu.id = g.black_user_id
      LEFT JOIN users win ON win.id = g.winner_user_id
      WHERE g.id = $1
    `,
    [gameId]
  )

  return mapGame(result.rows[0])
}

async function listChessGames(pool, user, scope = 'mine') {
  const params = []
  let where = ''

  if (scope === 'open') {
    where = "WHERE g.status = 'waiting' AND (g.white_user_id IS NULL OR g.black_user_id IS NULL)"
  } else if (scope === 'active') {
    where = "WHERE g.status = 'active'"
  } else if (scope === 'completed') {
    where = "WHERE g.status IN ('checkmate', 'draw', 'resigned', 'canceled')"
  } else {
    params.push(user.id)
    where = 'WHERE g.white_user_id = $1 OR g.black_user_id = $1'
  }

  const result = await pool.query(
    `
      SELECT g.*,
             wu.username AS white_username,
             bu.username AS black_username,
             win.username AS winner_username
      FROM chess_games g
      LEFT JOIN users wu ON wu.id = g.white_user_id
      LEFT JOIN users bu ON bu.id = g.black_user_id
      LEFT JOIN users win ON win.id = g.winner_user_id
      ${where}
      ORDER BY g.updated_at DESC, g.created_at DESC
      LIMIT 50
    `,
    params
  )

  return result.rows.map(mapGame)
}

async function createChessGame(pool, user, options = {}) {
  const color = normalizeColor(options.color)
  const opponentUserId = options.opponentUserId ? Number(options.opponentUserId) : null

  if (opponentUserId && opponentUserId === Number(user.id)) {
    throw new Error('Opponent must be another user')
  }

  const whiteUserId = color === 'white' ? user.id : opponentUserId
  const blackUserId = color === 'black' ? user.id : opponentUserId
  const status = whiteUserId && blackUserId ? 'active' : 'waiting'

  const result = await pool.query(
    `
      INSERT INTO chess_games (white_user_id, black_user_id, fen, status, turn_color)
      VALUES ($1, $2, $3, $4, 'white')
      RETURNING id
    `,
    [whiteUserId, blackUserId, startingFen, status]
  )

  return getChessGame(pool, result.rows[0].id)
}

async function createBotChessGame(pool, user, options = {}) {
  const playerColor = normalizeColor(options.color)
  const botLevel = normalizeBotLevel(options.level)
  const bot = await getChessBotUser(pool)
  const whiteUserId = playerColor === 'white' ? user.id : bot.id
  const blackUserId = playerColor === 'black' ? user.id : bot.id

  const result = await pool.query(
    `
      INSERT INTO chess_games (
        white_user_id,
        black_user_id,
        fen,
        status,
        turn_color,
        is_bot_game,
        bot_level
      )
      VALUES ($1, $2, $3, 'active', 'white', true, $4)
      RETURNING id
    `,
    [whiteUserId, blackUserId, startingFen, botLevel]
  )

  return getChessGame(pool, result.rows[0].id)
}

async function joinChessGame(pool, gameId, user, options = {}) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query('SELECT * FROM chess_games WHERE id = $1 FOR UPDATE', [gameId])
    const game = mapGame(result.rows[0])

    if (!game) {
      throw new Error('Game not found')
    }

    if (colorForUser(game, user.id)) {
      await client.query('COMMIT')
      return getChessGame(pool, game.id)
    }

    if (game.status !== 'waiting') {
      throw new Error('Game is not open')
    }

    let color = options.color === 'black' || options.color === 'white' ? options.color : null

    if (!color) {
      color = game.white_user_id ? 'black' : 'white'
    }

    if (color === 'white' && game.white_user_id) {
      throw new Error('White seat is taken')
    }

    if (color === 'black' && game.black_user_id) {
      throw new Error('Black seat is taken')
    }

    const whiteUserId = color === 'white' ? user.id : game.white_user_id
    const blackUserId = color === 'black' ? user.id : game.black_user_id
    const status = whiteUserId && blackUserId ? 'active' : 'waiting'

    await client.query(
      `
        UPDATE chess_games
        SET white_user_id = $1,
            black_user_id = $2,
            status = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `,
      [whiteUserId, blackUserId, status, game.id]
    )

    await client.query('COMMIT')
    return getChessGame(pool, game.id)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function listChessMoves(pool, gameId) {
  const result = await pool.query(
    `
      SELECT m.*, u.username
      FROM chess_moves m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.game_id = $1
      ORDER BY m.move_number ASC, m.id ASC
    `,
    [gameId]
  )

  return result.rows
}

async function makeChessMove(pool, gameId, user, moveInput = {}) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query('SELECT * FROM chess_games WHERE id = $1 FOR UPDATE', [gameId])
    const game = mapGame(result.rows[0])

    if (!game) {
      throw new Error('Game not found')
    }

    if (game.status !== 'active') {
      throw new Error('Game is not active')
    }

    const playerColor = colorForUser(game, user.id)

    if (!playerColor) {
      throw new Error('You are not a player in this game')
    }

    if (playerColor !== game.turn_color) {
      throw new Error('Not your turn')
    }

    const chess = new Chess(game.fen)
    const move = chess.move({
      from: moveInput.from,
      to: moveInput.to,
      promotion: moveInput.promotion || 'q',
    })

    if (!move) {
      throw new Error('Illegal move')
    }

    const fenAfter = chess.fen()
    const status = statusFromChess(chess)
    const winnerUserId = winnerFromChess(chess, game)
    const nextTurnColor = currentTurnColor(fenAfter)
    const endedAt = status === 'active' ? null : new Date()
    const moveCountResult = await client.query('SELECT COUNT(*)::integer AS count FROM chess_moves WHERE game_id = $1', [game.id])
    const moveNumber = Number(moveCountResult.rows[0].count) + 1

    await client.query(
      `
        INSERT INTO chess_moves (
          game_id,
          user_id,
          move_number,
          color,
          san,
          from_square,
          to_square,
          promotion,
          fen_after
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        game.id,
        user.id,
        moveNumber,
        playerColor,
        move.san,
        move.from,
        move.to,
        move.promotion || null,
        fenAfter,
      ]
    )

    await client.query(
      `
        UPDATE chess_games
        SET fen = $1,
            status = $2,
            turn_color = $3,
            winner_user_id = $4,
            ended_at = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `,
      [fenAfter, status, nextTurnColor, winnerUserId, endedAt, game.id]
    )

    await client.query('COMMIT')

    return {
      game: await getChessGame(pool, game.id),
      move: {
        game_id: game.id,
        user_id: user.id,
        move_number: moveNumber,
        color: playerColor,
        san: move.san,
        from_square: move.from,
        to_square: move.to,
        promotion: move.promotion || null,
        fen_after: fenAfter,
      },
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function resignChessGame(pool, gameId, user) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query('SELECT * FROM chess_games WHERE id = $1 FOR UPDATE', [gameId])
    const game = mapGame(result.rows[0])

    if (!game) {
      throw new Error('Game not found')
    }

    if (game.status !== 'active') {
      throw new Error('Game is not active')
    }

    const playerColor = colorForUser(game, user.id)

    if (!playerColor) {
      throw new Error('You are not a player in this game')
    }

    const winnerUserId = oppositeColor(playerColor) === 'white' ? game.white_user_id : game.black_user_id

    await client.query(
      `
        UPDATE chess_games
        SET status = 'resigned',
            winner_user_id = $1,
            ended_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [winnerUserId, game.id]
    )

    await client.query('COMMIT')
    return getChessGame(pool, game.id)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function cancelChessGame(pool, gameId, user) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query('SELECT * FROM chess_games WHERE id = $1 FOR UPDATE', [gameId])
    const game = mapGame(result.rows[0])

    if (!game) {
      throw new Error('Game not found')
    }

    if (game.status !== 'waiting') {
      throw new Error('Only waiting games can be canceled')
    }

    if (!colorForUser(game, user.id)) {
      throw new Error('You are not a player in this game')
    }

    await client.query(
      `
        UPDATE chess_games
        SET status = 'canceled',
            ended_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [game.id]
    )

    await client.query('COMMIT')
    return getChessGame(pool, game.id)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = {
  createChessTables,
  getChessBotUser,
  getChessGame,
  listChessGames,
  createChessGame,
  createBotChessGame,
  joinChessGame,
  listChessMoves,
  makeChessMove,
  resignChessGame,
  cancelChessGame,
}
