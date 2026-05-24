const {
  getChessGame,
  listChessMoves,
  makeChessMove,
  resignChessGame,
  cancelChessGame,
} = require('./chessStore')
const { playBotTurn } = require('./chessBotRunner')

function chessRoom(gameId) {
  return `chess:game:${gameId}`
}

function emitGameUpdate(io, game) {
  io.emit('chess:gameUpdated', game)
}

function emitMoveMade(io, result) {
  io.to(chessRoom(result.game.id)).emit('chess:moveMade', result)
  emitGameUpdate(io, result.game)
}

async function playAndEmitBotTurn(pool, io, gameId) {
  const botResult = await playBotTurn(pool, gameId)

  if (botResult) {
    emitMoveMade(io, botResult)
  }

  return botResult
}

function registerChessSockets(io, socket, { pool }) {
  socket.data.chessGameIds = new Set()

  socket.on('chess:joinGame', async (gameId, callback) => {
    try {
      const game = await getChessGame(pool, gameId)

      if (!game) {
        callback?.({ error: 'Game not found' })
        return
      }

      socket.join(chessRoom(game.id))
      socket.data.chessGameIds.add(String(game.id))

      const moves = await listChessMoves(pool, game.id)
      callback?.({ game, moves })
    } catch (err) {
      console.error('Error joining chess game:', err)
      callback?.({ error: 'Failed to join chess game' })
    }
  })

  socket.on('chess:leaveGame', (gameId, callback) => {
    socket.leave(chessRoom(gameId))
    socket.data.chessGameIds.delete(String(gameId))
    callback?.({ ok: true })
  })

  socket.on('chess:move', async (data, callback) => {
    const { gameId, from, to, promotion } = data || {}

    if (!gameId || !from || !to) {
      callback?.({ error: 'Move needs gameId, from, and to' })
      return
    }

    try {
      const result = await makeChessMove(pool, gameId, socket.data.user, {
        from,
        to,
        promotion,
      })

      emitMoveMade(io, result)
      callback?.(result)
      await playAndEmitBotTurn(pool, io, result.game.id)
    } catch (err) {
      callback?.({ error: err.message || 'Failed to make chess move' })
    }
  })

  socket.on('chess:resign', async (data, callback) => {
    const { gameId } = data || {}

    if (!gameId) {
      callback?.({ error: 'Game id is required' })
      return
    }

    try {
      const game = await resignChessGame(pool, gameId, socket.data.user)
      emitGameUpdate(io, game)
      callback?.({ game })
    } catch (err) {
      callback?.({ error: err.message || 'Failed to resign chess game' })
    }
  })

  socket.on('chess:cancel', async (data, callback) => {
    const { gameId } = data || {}

    if (!gameId) {
      callback?.({ error: 'Game id is required' })
      return
    }

    try {
      const game = await cancelChessGame(pool, gameId, socket.data.user)
      emitGameUpdate(io, game)
      callback?.({ game })
    } catch (err) {
      callback?.({ error: err.message || 'Failed to cancel chess game' })
    }
  })
}

module.exports = registerChessSockets
