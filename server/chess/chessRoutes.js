const express = require('express')
const {
  getChessGame,
  getChessGameForUser,
  listChessGames,
  createChessGame,
  createBotChessGame,
  joinChessGame,
  listChessMoves,
  makeChessMove,
  resignChessGame,
  timeoutChessGame,
  cancelChessGame,
  deleteChessGame,
  closeChessGameChat,
} = require('./chessStore')
const { botLevels, openingBook } = require('./chessBot')
const { playBotTurn } = require('./chessBotRunner')
const { getBotThinking, setBotThinking } = require('./chessBotThinking')
const { postChessOpeningMessage } = require('./chessOpeningMessages')

function emitGameUpdate(io, game) {
  io.emit('chess:gameUpdated', game)
}

function emitMoveMade(io, result) {
  if (result.move) {
    io.to(`chess:game:${result.game.id}`).emit('chess:moveMade', result)
  }
  emitGameUpdate(io, result.game)
}

function emitBotThinking(io, update) {
  io.emit('chess:botThinking', setBotThinking(update) || update)
}

function queueBotTurn(pool, io, gameId) {
  setImmediate(() => {
    playAndEmitBotTurn(pool, io, gameId).catch((err) => {
      console.error('Error playing queued bot chess turn:', err)
    })
  })
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

function createChessRouter({ pool, authenticate, io }) {
  const router = express.Router()

  router.use(authenticate)

  router.get('/bot-levels', (req, res) => {
    res.json({ levels: botLevels })
  })

  router.get('/openings', (req, res) => {
    res.json(openingBook)
  })

  router.get('/games', async (req, res) => {
    try {
      const games = await listChessGames(pool, req.user, req.query.scope)
      res.json({ games })
    } catch (err) {
      console.error('Error listing chess games:', err)
      res.status(500).json({ error: 'Failed to list chess games' })
    }
  })

  router.post('/games', async (req, res) => {
    try {
      const game = await createChessGame(pool, req.user, {
        color: req.body?.color,
        opponentUserId: req.body?.opponentUserId,
        timeControlSeconds: req.body?.timeControlSeconds,
      })

      emitGameUpdate(io, game)
      res.status(201).json({ game })
    } catch (err) {
      console.error('Error creating chess game:', err)
      const status = err.message === 'Opponent must be another user' ? 400 : 500
      res.status(status).json({ error: err.message || 'Failed to create chess game' })
    }
  })

  router.post('/bot-games', async (req, res) => {
    try {
      const game = await createBotChessGame(pool, req.user, {
        color: req.body?.color,
        level: req.body?.level,
        timeControlSeconds: req.body?.timeControlSeconds,
      })
      const moves = await listChessMoves(pool, game.id)

      emitGameUpdate(io, game)
      res.status(201).json({ game, moves })
      queueBotTurn(pool, io, game.id)
    } catch (err) {
      console.error('Error creating bot chess game:', err)
      res.status(500).json({ error: err.message || 'Failed to create bot chess game' })
    }
  })

  router.get('/games/:id', async (req, res) => {
    try {
      const game = await getChessGameForUser(pool, req.params.id, req.user)

      if (!game) {
        return res.status(404).json({ error: 'Game not found' })
      }

      const moves = await listChessMoves(pool, game.id)
      res.json({
        game,
        moves,
        botThinking: getBotThinking(game.id),
      })
    } catch (err) {
      console.error('Error fetching chess game:', err)
      res.status(500).json({ error: 'Failed to fetch chess game' })
    }
  })

  router.post('/games/:id/join', async (req, res) => {
    try {
      const game = await joinChessGame(pool, req.params.id, req.user, {
        color: req.body?.color,
      })

      emitGameUpdate(io, game)
      res.json({ game })
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to join chess game' })
    }
  })

  router.post('/games/:id/moves', async (req, res) => {
    try {
      const result = await makeChessMove(pool, req.params.id, req.user, {
        from: req.body?.from,
        to: req.body?.to,
        promotion: req.body?.promotion,
      })

      await emitMoveAndOpening(pool, io, result)
      await playAndEmitBotTurn(pool, io, result.game.id)
      res.status(201).json(result)
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to make chess move' })
    }
  })

  router.post('/games/:id/resign', async (req, res) => {
    try {
      const game = await resignChessGame(pool, req.params.id, req.user)
      emitGameUpdate(io, game)
      res.json({ game })
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to resign chess game' })
    }
  })

  router.post('/games/:id/timeout', async (req, res) => {
    try {
      const game = await timeoutChessGame(pool, req.params.id, req.user)
      emitGameUpdate(io, game)
      res.json({ game })
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to timeout chess game' })
    }
  })

  router.post('/games/:id/cancel', async (req, res) => {
    try {
      const game = await cancelChessGame(pool, req.params.id, req.user)
      emitGameUpdate(io, game)
      res.json({ game })
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to cancel chess game' })
    }
  })

  router.post('/games/:id/close-chat', async (req, res) => {
    try {
      const game = await closeChessGameChat(pool, req.params.id, req.user)
      emitGameUpdate(io, game)
      res.json({ game })
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to close game chat' })
    }
  })

  router.delete('/games/:id', async (req, res) => {
    try {
      const game = await deleteChessGame(pool, req.params.id, req.user)
      io.emit('chess:gameDeleted', { id: game.id })
      res.json({ game })
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to delete chess game' })
    }
  })

  return router
}

module.exports = createChessRouter
