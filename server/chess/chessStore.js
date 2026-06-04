const { Chess } = require('chess.js')
const crypto = require('crypto')
const { normalizeBotLevel } = require('./chessBot')

const startingFen = new Chess().fen()
const chessBotUsername = 'PawnedBot'
const timeControls = new Set([60, 300, 600, 5400])

function isAdminUser(user) {
  return Boolean(user?.is_admin || user?.role === 'admin' || user?.role === 'developer')
}

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

function normalizeTimeControlSeconds(value) {
  if (value === null || value === undefined || value === '' || value === 'unlimited') {
    return null
  }

  const seconds = Number(value)
  return timeControls.has(seconds) ? seconds : null
}

function timeControlMilliseconds(seconds) {
  return seconds ? seconds * 1000 : null
}

function timestampMs(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  const ms = date.getTime()
  return Number.isFinite(ms) ? ms : null
}

function applyClock(game, now = new Date()) {
  if (!game?.time_control_seconds || game.status !== 'active' || !game.clock_started_at) {
    return game
  }

  const startedMs = timestampMs(game.clock_started_at)

  if (!startedMs) {
    return game
  }

  const elapsed = Math.max(0, now.getTime() - startedMs)
  const whiteTimeMs = Number(game.white_time_ms)
  const blackTimeMs = Number(game.black_time_ms)

  return {
    ...game,
    white_time_ms: game.turn_color === 'white' ? Math.max(0, whiteTimeMs - elapsed) : whiteTimeMs,
    black_time_ms: game.turn_color === 'black' ? Math.max(0, blackTimeMs - elapsed) : blackTimeMs,
  }
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
    creator_user_id: row.creator_user_id === null || row.creator_user_id === undefined ? null : Number(row.creator_user_id),
    chat_channel_id: row.chat_channel_id === null || row.chat_channel_id === undefined ? null : Number(row.chat_channel_id),
    winner_user_id: row.winner_user_id === null ? null : Number(row.winner_user_id),
    bot_level: row.bot_level === null || row.bot_level === undefined ? null : Number(row.bot_level),
    time_control_seconds: row.time_control_seconds === null || row.time_control_seconds === undefined ? null : Number(row.time_control_seconds),
    white_time_ms: row.white_time_ms === null || row.white_time_ms === undefined ? null : Number(row.white_time_ms),
    black_time_ms: row.black_time_ms === null || row.black_time_ms === undefined ? null : Number(row.black_time_ms),
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
      creator_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      chat_channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
      chat_closed_at TIMESTAMP,
      winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP,
      is_bot_game BOOLEAN DEFAULT FALSE,
      bot_level INTEGER,
      time_control_seconds INTEGER,
      white_time_ms INTEGER,
      black_time_ms INTEGER,
      clock_started_at TIMESTAMP,
      deleted_at TIMESTAMP
    )
  `)

  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS is_bot_game BOOLEAN DEFAULT FALSE')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS bot_level INTEGER')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS creator_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS chat_channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS chat_closed_at TIMESTAMP')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS time_control_seconds INTEGER')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS white_time_ms INTEGER')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS black_time_ms INTEGER')
  await pool.query('ALTER TABLE chess_games ADD COLUMN IF NOT EXISTS clock_started_at TIMESTAMP')

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

async function getChessGameForUser(pool, gameId, user) {
  const game = await getChessGame(pool, gameId)

  if (!game) {
    return null
  }

  return {
    ...game,
    can_delete: canDeleteChessGame(game, user),
  }
}

async function ensureChessGameChat(pool, game, ownerUserId) {
  if (game.chat_channel_id) {
    return game
  }

  const channelResult = await pool.query(
    `
      INSERT INTO channels (name, description, is_private, owner_user_id)
      VALUES ($1, $2, false, $3)
      RETURNING id
    `,
    [`chess-${game.id}`, `Chat for chess game ${game.id}`, ownerUserId]
  )
  const channelId = channelResult.rows[0].id

  await pool.query(
    'UPDATE chess_games SET chat_channel_id = $1 WHERE id = $2',
    [channelId, game.id]
  )

  return getChessGame(pool, game.id)
}

async function listChessGames(pool, user, scope = 'mine') {
  const params = []
  let where = ''

  if (scope === 'open') {
    where = "WHERE g.deleted_at IS NULL AND g.status = 'waiting' AND (g.white_user_id IS NULL OR g.black_user_id IS NULL)"
  } else if (scope === 'active') {
    where = "WHERE g.deleted_at IS NULL AND g.status = 'active'"
  } else if (scope === 'completed') {
    where = "WHERE g.deleted_at IS NULL AND g.status IN ('checkmate', 'draw', 'resigned', 'timeout', 'canceled')"
  } else {
    if (!user) {
      return []
    }

    params.push(user.id)
    where = 'WHERE g.deleted_at IS NULL AND (g.white_user_id = $1 OR g.black_user_id = $1)'
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

  return result.rows.map((row) => {
    const game = mapGame(row)

    return {
      ...game,
      can_delete: canDeleteChessGame(game, user),
    }
  })
}

async function createChessGame(pool, user, options = {}) {
  const color = normalizeColor(options.color)
  const opponentUserId = options.opponentUserId ? Number(options.opponentUserId) : null
  const timeControlSeconds = normalizeTimeControlSeconds(options.timeControlSeconds)
  const timeControlMs = timeControlMilliseconds(timeControlSeconds)

  if (opponentUserId && opponentUserId === Number(user.id)) {
    throw new Error('Opponent must be another user')
  }

  const whiteUserId = color === 'white' ? user.id : opponentUserId
  const blackUserId = color === 'black' ? user.id : opponentUserId
  const status = whiteUserId && blackUserId ? 'active' : 'waiting'

  const result = await pool.query(
    `
      INSERT INTO chess_games (
        white_user_id,
        black_user_id,
        creator_user_id,
        fen,
        status,
        turn_color,
        time_control_seconds,
        white_time_ms,
        black_time_ms,
        clock_started_at
      )
      VALUES ($1, $2, $3, $4, $5::varchar, 'white', $6::integer, $7::integer, $7::integer, CASE WHEN $5::varchar = 'active' AND $6::integer IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END)
      RETURNING id
    `,
    [whiteUserId, blackUserId, user.id, startingFen, status, timeControlSeconds, timeControlMs]
  )

  const game = await getChessGame(pool, result.rows[0].id)
  return ensureChessGameChat(pool, game, user.id)
}

async function createBotChessGame(pool, user, options = {}) {
  const playerColor = normalizeColor(options.color)
  const botLevel = normalizeBotLevel(options.level)
  const timeControlSeconds = normalizeTimeControlSeconds(options.timeControlSeconds)
  const timeControlMs = timeControlMilliseconds(timeControlSeconds)
  const bot = await getChessBotUser(pool)
  const whiteUserId = playerColor === 'white' ? user.id : bot.id
  const blackUserId = playerColor === 'black' ? user.id : bot.id

  const result = await pool.query(
    `
      INSERT INTO chess_games (
        white_user_id,
        black_user_id,
        creator_user_id,
        fen,
        status,
        turn_color,
        is_bot_game,
        bot_level,
        time_control_seconds,
        white_time_ms,
        black_time_ms,
        clock_started_at
      )
      VALUES ($1, $2, $3, $4, 'active', 'white', true, $5, $6::integer, $7::integer, $7::integer, CASE WHEN $6::integer IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END)
      RETURNING id
    `,
    [whiteUserId, blackUserId, user.id, startingFen, botLevel, timeControlSeconds, timeControlMs]
  )

  const game = await getChessGame(pool, result.rows[0].id)
  return ensureChessGameChat(pool, game, user.id)
}

async function closeChessGameChat(pool, gameId, user) {
  const game = await getChessGame(pool, gameId)

  if (!game) {
    throw new Error('Game not found')
  }

  if (!['checkmate', 'draw', 'resigned', 'timeout', 'canceled'].includes(game.status)) {
    throw new Error('Game is not finished')
  }

  const isCreator = Number(game.creator_user_id) === Number(user.id)

  if (!isAdminUser(user) && !isCreator) {
    throw new Error('You cannot close this chat')
  }

  await pool.query(
    `
      UPDATE chess_games
      SET chat_closed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [game.id]
  )

  return getChessGame(pool, game.id)
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
            status = $3::varchar,
            clock_started_at = CASE WHEN $3::varchar = 'active' AND time_control_seconds IS NOT NULL THEN CURRENT_TIMESTAMP ELSE clock_started_at END,
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

    const now = new Date()
    const clockGame = applyClock(game, now)
    const remainingMs = playerColor === 'white' ? clockGame.white_time_ms : clockGame.black_time_ms

    if (game.time_control_seconds && remainingMs <= 0) {
      const winnerUserId = oppositeColor(playerColor) === 'white' ? game.white_user_id : game.black_user_id

      await client.query(
        `
          UPDATE chess_games
          SET status = 'timeout',
              winner_user_id = $1,
              white_time_ms = $2,
              black_time_ms = $3,
              ended_at = $4,
              clock_started_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `,
        [winnerUserId, clockGame.white_time_ms, clockGame.black_time_ms, now, game.id]
      )

      await client.query('COMMIT')
      return {
        game: await getChessGame(pool, game.id),
        move: null,
      }
    }

    const chess = new Chess(game.fen)
    const movingPiece = moveInput.from ? chess.get(moveInput.from) : null
    const promotionRank = movingPiece?.color === 'w' ? '8' : '1'
    const isPromotion = movingPiece?.type === 'p' && moveInput.to?.[1] === promotionRank
    const movePayload = {
      from: moveInput.from,
      to: moveInput.to,
    }

    if (isPromotion || moveInput.promotion) {
      movePayload.promotion = moveInput.promotion || 'q'
    }

    const move = chess.move(movePayload)

    if (!move) {
      throw new Error('Illegal move')
    }

    const fenAfter = chess.fen()
    const status = statusFromChess(chess)
    const winnerUserId = winnerFromChess(chess, game)

    const nextTurnColor = currentTurnColor(fenAfter)
    const endedAt = status === 'active' ? null : now
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
            white_time_ms = $6,
            black_time_ms = $7,
            clock_started_at = $8,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
      `,
      [
        fenAfter,
        status,
        nextTurnColor,
        winnerUserId,
        endedAt,
        clockGame.white_time_ms,
        clockGame.black_time_ms,
        status === 'active' && game.time_control_seconds ? now : null,
        game.id,
      ]
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

async function undoChessMove(pool, gameId, user) {
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

    if (!colorForUser(game, user.id)) {
      throw new Error('You are not a player in this game')
    }

    const movesResult = await client.query(
      `
        SELECT *
        FROM chess_moves
        WHERE game_id = $1
        ORDER BY move_number ASC, id ASC
      `,
      [game.id]
    )
    const moves = movesResult.rows

    if (moves.length === 0) {
      throw new Error('No moves to undo')
    }

    const bot = game.is_bot_game ? await getChessBotUser(pool) : null
    const lastMove = moves[moves.length - 1]
    let keepCount = moves.length - 1

    if (bot && Number(lastMove.user_id) === Number(bot.id)) {
      keepCount = Math.max(0, moves.length - 2)
    } else if (Number(lastMove.user_id) !== Number(user.id)) {
      throw new Error('You can only undo your last move')
    }

    const previousMove = keepCount > 0 ? moves[keepCount - 1] : null
    const fen = previousMove?.fen_after || startingFen
    const turnColor = currentTurnColor(fen)
    const now = new Date()

    await client.query(
      `
        DELETE FROM chess_moves
        WHERE game_id = $1
          AND move_number > $2
      `,
      [game.id, keepCount]
    )

    await client.query(
      `
        UPDATE chess_games
        SET fen = $1,
            status = 'active',
            turn_color = $2,
            winner_user_id = NULL,
            ended_at = NULL,
            clock_started_at = CASE WHEN time_control_seconds IS NOT NULL THEN $3::timestamp ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `,
      [fen, turnColor, now, game.id]
    )

    await client.query('COMMIT')

    return {
      game: await getChessGame(pool, game.id),
      moves: await listChessMoves(pool, game.id),
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

async function timeoutChessGame(pool, gameId, user) {
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

    if (!game.time_control_seconds) {
      throw new Error('Game has no time limit')
    }

    const now = new Date()
    const clockGame = applyClock(game, now)
    const remainingMs = game.turn_color === 'white' ? clockGame.white_time_ms : clockGame.black_time_ms

    if (remainingMs > 0) {
      throw new Error('Time is not out')
    }

    const winnerUserId = game.turn_color === 'white' ? game.black_user_id : game.white_user_id

    await client.query(
      `
        UPDATE chess_games
        SET status = 'timeout',
            winner_user_id = $1,
            white_time_ms = $2,
            black_time_ms = $3,
            ended_at = $4,
            clock_started_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `,
      [winnerUserId, clockGame.white_time_ms, clockGame.black_time_ms, now, game.id]
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

async function deleteChessGame(pool, gameId, user) {
  const result = await pool.query('SELECT * FROM chess_games WHERE id = $1', [gameId])
  const game = mapGame(result.rows[0])

  if (!game) {
    throw new Error('Game not found')
  }

  if (!['checkmate', 'draw', 'resigned', 'timeout', 'canceled'].includes(game.status)) {
    throw new Error('Only completed games can be deleted')
  }

  const isCreator = Number(game.creator_user_id) === Number(user.id)
  const isPlayer = Number(game.white_user_id) === Number(user.id) || Number(game.black_user_id) === Number(user.id)

  if (!isAdminUser(user) && !isCreator && !(game.status === 'canceled' && isPlayer)) {
    throw new Error('You cannot delete this game')
  }

  await pool.query(
    `
      UPDATE chess_games
      SET deleted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [game.id]
  )

  return game
}

function canDeleteChessGame(game, user) {
  if (!game || !user || game.deleted_at || !['checkmate', 'draw', 'resigned', 'timeout', 'canceled'].includes(game.status)) {
    return false
  }

  const isCreator = Number(game.creator_user_id) === Number(user.id)
  const isPlayer = Number(game.white_user_id) === Number(user.id) || Number(game.black_user_id) === Number(user.id)
  return Boolean(isAdminUser(user) || isCreator || (game.status === 'canceled' && isPlayer))
}

module.exports = {
  createChessTables,
  getChessBotUser,
  getChessGame,
  getChessGameForUser,
  ensureChessGameChat,
  listChessGames,
  createChessGame,
  createBotChessGame,
  joinChessGame,
  listChessMoves,
  makeChessMove,
  undoChessMove,
  resignChessGame,
  timeoutChessGame,
  cancelChessGame,
  deleteChessGame,
  canDeleteChessGame,
  closeChessGameChat,
}
