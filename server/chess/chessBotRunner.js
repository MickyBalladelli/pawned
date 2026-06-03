const path = require('path')
const { Worker } = require('worker_threads')
const {
  getChessBotUser,
  getChessGame,
  listChessMoves,
  makeChessMove,
} = require('./chessStore')

function runBotSearch(game, moveHistory, options = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'chessBotWorker.js'), {
      workerData: {
        fen: game.fen,
        level: game.bot_level,
        moveHistory,
      },
    })
    const hardTimeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('Bot search timed out'))
    }, 60000)

    worker.on('message', (message) => {
      if (message.type === 'bestMove') {
        options.onBestMove?.(message.bestMove)
        return
      }

      if (message.type === 'done') {
        clearTimeout(hardTimeout)
        resolve(message.move)
        return
      }

      if (message.type === 'error') {
        clearTimeout(hardTimeout)
        reject(new Error(message.error))
      }
    })

    worker.on('error', (err) => {
      clearTimeout(hardTimeout)
      reject(err)
    })

    worker.on('exit', (code) => {
      clearTimeout(hardTimeout)

      if (code !== 0) {
        reject(new Error(`Bot worker exited with code ${code}`))
      }
    })
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
  options.onThinking?.({
    gameId: game.id,
    thinking: true,
    bestMove: null,
  })

  try {
    const move = await runBotSearch(game, moves.map((item) => item.san), {
      onBestMove: (bestMove) => {
        options.onThinking?.({
          gameId: game.id,
          thinking: true,
          bestMove,
        })
      },
    })

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
