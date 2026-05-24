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
  cancelChessGame,
  deleteChessGame,
} = require('./chessStore')
const { botLevels, openingBook } = require('./chessBot')
const { playBotTurn } = require('./chessBotRunner')

function emitGameUpdate(io, game) {
  io.emit('chess:gameUpdated', game)
}

function emitMoveMade(io, result) {
  io.to(`chess:game:${result.game.id}`).emit('chess:moveMade', result)
  emitGameUpdate(io, result.game)
}

async function playAndEmitBotTurn(pool, io, gameId) {
  const botResult = await playBotTurn(pool, gameId)

  if (botResult) {
    emitMoveMade(io, botResult)
  }

  return botResult
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
      })
      const botResult = await playAndEmitBotTurn(pool, io, game.id)
      const activeGame = botResult?.game || game
      const moves = await listChessMoves(pool, activeGame.id)

      emitGameUpdate(io, activeGame)
      res.status(201).json({ game: activeGame, moves })
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
      res.json({ game, moves })
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

      emitMoveMade(io, result)
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
