const {
  getChessGame,
  listChessMoves,
  makeChessMove,
  resignChessGame,
  cancelChessGame,
} = require('./chessStore')

function chessRoom(gameId) {
  return `chess:game:${gameId}`
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

      io.to(chessRoom(result.game.id)).emit('chess:moveMade', result)
      io.to(`user:${result.game.white_user_id}`).to(`user:${result.game.black_user_id}`).emit('chess:gameUpdated', result.game)
      callback?.(result)
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
      io.to(chessRoom(game.id)).to(`user:${game.white_user_id}`).to(`user:${game.black_user_id}`).emit('chess:gameUpdated', game)
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
      io.to(chessRoom(game.id)).to(`user:${game.white_user_id}`).to(`user:${game.black_user_id}`).emit('chess:gameUpdated', game)
      callback?.({ game })
    } catch (err) {
      callback?.({ error: err.message || 'Failed to cancel chess game' })
    }
  })
}

module.exports = registerChessSockets
