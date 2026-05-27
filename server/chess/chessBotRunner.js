const { Chess } = require('chess.js')
const { chooseBotMove } = require('./chessBot')
const {
  getChessBotUser,
  getChessGame,
  listChessMoves,
  makeChessMove,
} = require('./chessStore')

function getBotColor(game, botUserId) {
  if (Number(game.white_user_id) === Number(botUserId)) {
    return 'white'
  }

  if (Number(game.black_user_id) === Number(botUserId)) {
    return 'black'
  }

  return null
}

async function playBotTurn(pool, gameId) {
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
  const move = chooseBotMove(
    chess,
    moves.map((item) => item.san),
    game.bot_level
  )

  if (!move) {
    return null
  }

  return makeChessMove(pool, game.id, bot, move)
}

module.exports = {
  playBotTurn,
}
