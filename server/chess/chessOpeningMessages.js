const openingBook = require('../../client/src/data/chessOpenings.json')

function normalizeSan(san) {
  return String(san || '')
    .replace(/[+#]+$/u, '')
    .replace(/[!?]+$/u, '')
}

function movesMatch(openingMoves, history) {
  if (openingMoves.length > history.length) {
    return false
  }

  return openingMoves.every((move, index) => normalizeSan(move) === normalizeSan(history[index]))
}

function historyStartsOpening(openingMoves, history) {
  if (history.length === 0 || history.length > openingMoves.length) {
    return false
  }

  return history.every((move, index) => normalizeSan(move) === normalizeSan(openingMoves[index]))
}

function findOpeningFromMoves(moves) {
  const history = moves.map((move) => move.san).filter(Boolean)

  if (history.length === 0) {
    return null
  }

  const exact = openingBook.openings
    .filter((opening) => movesMatch(opening.moves, history))
    .sort((a, b) => b.moves.length - a.moves.length)[0]

  if (exact) {
    return exact
  }

  return openingBook.openings
    .filter((opening) => historyStartsOpening(opening.moves, history))
    .sort((a, b) => a.moves.length - b.moves.length)[0] || null
}

const announcedOpenings = new Set()

function openingNotice(gameId, channelId, opening) {
  return {
    id: `chess-opening-${gameId}-${opening.eco}-${opening.name}`,
    channel_id: Number(channelId),
    type: 'opening',
    is_presence_notice: true,
    created_at: new Date().toISOString(),
    content: `Opening: ${opening.name} (${opening.eco})`,
  }
}

async function postChessOpeningMessage(pool, io, gameId) {
  const gameResult = await pool.query(
    'SELECT chat_channel_id FROM chess_games WHERE id = $1',
    [gameId]
  )
  const game = gameResult.rows[0]

  if (!game?.chat_channel_id) {
    return null
  }

  const movesResult = await pool.query(
    'SELECT san FROM chess_moves WHERE game_id = $1 ORDER BY move_number ASC, id ASC',
    [gameId]
  )
  const opening = findOpeningFromMoves(movesResult.rows)

  if (!opening) {
    return null
  }

  const key = `${gameId}:${opening.eco}:${opening.name}`

  if (announcedOpenings.has(key)) {
    return null
  }

  announcedOpenings.add(key)
  const message = openingNotice(gameId, game.chat_channel_id, opening)

  io.to(String(game.chat_channel_id)).emit('chess:notice', message)
  io.to(`chess:game:${gameId}`).emit('chess:chatMessage', message)
  return message
}

module.exports = {
  findOpeningFromMoves,
  postChessOpeningMessage,
}
