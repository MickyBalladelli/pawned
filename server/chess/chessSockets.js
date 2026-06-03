const {
  getChessGame,
  listChessMoves,
  makeChessMove,
  resignChessGame,
  timeoutChessGame,
  cancelChessGame,
} = require('./chessStore')
const { playBotTurn } = require('./chessBotRunner')
const { getBotThinking, setBotThinking } = require('./chessBotThinking')
const { postChessOpeningMessage } = require('./chessOpeningMessages')

function chessRoom(gameId) {
  return `chess:game:${gameId}`
}

function emitGameUpdate(io, game) {
  io.emit('chess:gameUpdated', game)
}

function emitMoveMade(io, result) {
  if (result.move) {
    io.to(chessRoom(result.game.id)).emit('chess:moveMade', result)
  }
  emitGameUpdate(io, result.game)
}

function emitBotThinking(io, update) {
  io.emit('chess:botThinking', setBotThinking(update) || update)
}

function emitChessNotice(io, game, user, type) {
  if (!game.chat_channel_id) {
    return
  }

  const content = `${user.username} has ${type === 'join' ? 'joined' : 'left'} the game`
  const notice = {
    id: `chess-presence-${Date.now()}-${user.id}-${type}-${game.id}`,
    channel_id: Number(game.chat_channel_id),
    username: user.username,
    type,
    is_presence_notice: true,
    created_at: new Date().toISOString(),
    content,
  }

  io.to(chessRoom(game.id)).emit('chess:chatMessage', notice)
  io.to(String(game.chat_channel_id)).emit('chess:notice', notice)
}

async function playAndEmitBotTurn(pool, io, gameId) {
  const botResult = await playBotTurn(pool, gameId, {
    onThinking: (update) => emitBotThinking(io, update),
  })

  if (botResult) {
    await emitMoveAndOpening(pool, io, botResult)
  }

  return botResult
}

async function emitMoveAndOpening(pool, io, result) {
  emitMoveMade(io, result)
  await postChessOpeningMessage(pool, io, result.game.id)
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

      const alreadyJoined = socket.data.chessGameIds.has(String(game.id))
      socket.join(chessRoom(game.id))
      socket.data.chessGameIds.add(String(game.id))

      if (!alreadyJoined) {
        emitChessNotice(io, game, socket.data.user, 'join')
      }

      const moves = await listChessMoves(pool, game.id)
      const botThinking = getBotThinking(game.id)

      if (botThinking) {
        socket.emit('chess:botThinking', botThinking)
      }

      callback?.({ game, moves, botThinking })
    } catch (err) {
      console.error('Error joining chess game:', err)
      callback?.({ error: 'Failed to join chess game' })
    }
  })

  socket.on('chess:leaveGame', async (gameId, callback) => {
    try {
      const game = await getChessGame(pool, gameId)
      const wasJoined = socket.data.chessGameIds.has(String(gameId))

      if (game && wasJoined) {
        emitChessNotice(io, game, socket.data.user, 'leave')
      }

      socket.leave(chessRoom(gameId))
      socket.data.chessGameIds.delete(String(gameId))
      callback?.({ ok: true })
    } catch (err) {
      callback?.({ error: 'Failed to leave chess game' })
    }
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

      await emitMoveAndOpening(pool, io, result)
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

  socket.on('chess:timeout', async (data, callback) => {
    const { gameId } = data || {}

    if (!gameId) {
      callback?.({ error: 'Game id is required' })
      return
    }

    try {
      const game = await timeoutChessGame(pool, gameId, socket.data.user)
      emitGameUpdate(io, game)
      callback?.({ game })
    } catch (err) {
      callback?.({ error: err.message || 'Failed to timeout chess game' })
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

  socket.on('disconnect', async () => {
    for (const gameId of socket.data.chessGameIds || []) {
      const game = await getChessGame(pool, gameId).catch(() => null)

      if (game) {
        emitChessNotice(io, game, socket.data.user, 'leave')
      }
    }
  })
}

module.exports = registerChessSockets
