const express = require('express')
const {
  getChessGame,
  listChessGames,
  createChessGame,
  joinChessGame,
  listChessMoves,
  makeChessMove,
  resignChessGame,
  cancelChessGame,
} = require('./chessStore')

function createChessRouter({ pool, authenticate, io }) {
  const router = express.Router()

  router.use(authenticate)

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

      io.to(`user:${game.white_user_id}`).to(`user:${game.black_user_id}`).emit('chess:gameUpdated', game)
      res.status(201).json({ game })
    } catch (err) {
      console.error('Error creating chess game:', err)
      const status = err.message === 'Opponent must be another user' ? 400 : 500
      res.status(status).json({ error: err.message || 'Failed to create chess game' })
    }
  })

  router.get('/games/:id', async (req, res) => {
    try {
      const game = await getChessGame(pool, req.params.id)

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

      io.to(`chess:game:${game.id}`).to(`user:${game.white_user_id}`).to(`user:${game.black_user_id}`).emit('chess:gameUpdated', game)
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

      io.to(`chess:game:${result.game.id}`).emit('chess:moveMade', result)
      io.to(`user:${result.game.white_user_id}`).to(`user:${result.game.black_user_id}`).emit('chess:gameUpdated', result.game)
      res.status(201).json(result)
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to make chess move' })
    }
  })

  router.post('/games/:id/resign', async (req, res) => {
    try {
      const game = await resignChessGame(pool, req.params.id, req.user)
      io.to(`chess:game:${game.id}`).to(`user:${game.white_user_id}`).to(`user:${game.black_user_id}`).emit('chess:gameUpdated', game)
      res.json({ game })
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to resign chess game' })
    }
  })

  router.post('/games/:id/cancel', async (req, res) => {
    try {
      const game = await cancelChessGame(pool, req.params.id, req.user)
      io.to(`chess:game:${game.id}`).to(`user:${game.white_user_id}`).to(`user:${game.black_user_id}`).emit('chess:gameUpdated', game)
      res.json({ game })
    } catch (err) {
      const status = err.message === 'Game not found' ? 404 : 400
      res.status(status).json({ error: err.message || 'Failed to cancel chess game' })
    }
  })

  return router
}

module.exports = createChessRouter
