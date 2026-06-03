const { Chess } = require('chess.js')
const { chooseBotMove } = require('./chessBot')
const {
  getChessBotUser,
  getChessGame,
  listChessMoves,
  makeChessMove,
} = require('./chessStore')

function nextTick() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function getBotColor(game, botUserId) {
  if (Number(game.white_user_id) === Number(botUserId)) {
    return 'white'
  }

  if (Number(game.black_user_id) === Number(botUserId)) {
    return 'black'
  }

  return null
}

async function playBotTurn(pool, gameId, options = {}) {
  const bot = await getChessBotUser(pool)
  const game = await getChessGame(pool, gameId)

  if (!game || !game.is_bot_game || game.status !== 'active') {
    return null
  }

  const botColor = getBotColor(game, bot.id)

  if (!botColor || game.turn_color !== botColor) {
    return null
  }

  const moves = await listChessMoves(pool, game.id)
  const chess = new Chess(game.fen)
  options.onThinking?.({
    gameId: game.id,
    thinking: true,
    bestMove: null,
  })
  await nextTick()

  try {
    const move = await chooseBotMove(
      chess,
      moves.map((item) => item.san),
      game.bot_level,
      {
        onBestMove: (bestMove) => {
          options.onThinking?.({
            gameId: game.id,
            thinking: true,
            bestMove: {
              from: bestMove.from,
              to: bestMove.to,
              promotion: bestMove.promotion || null,
              depth: bestMove.depth,
              nodes: bestMove.nodes,
              score: bestMove.score,
            },
          })
        },
      }
    )

    if (!move) {
      return null
    }

    return await makeChessMove(pool, game.id, bot, move)
  } finally {
    options.onThinking?.({
      gameId: game.id,
      thinking: false,
      bestMove: null,
    })
  }
}

module.exports = {
  playBotTurn,
}
