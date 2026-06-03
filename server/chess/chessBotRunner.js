const path = require('path')
const os = require('os')
const { Worker } = require('worker_threads')
const { Chess } = require('chess.js')
const { getLevelProfile } = require('./chessBot')
const {
  getChessBotUser,
  getChessGame,
  listChessMoves,
  makeChessMove,
} = require('./chessStore')

function moveKey(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

function splitMoves(moves, workerCount) {
  return moves.reduce((groups, move, index) => {
    groups[index % workerCount].push(moveKey(move))
    return groups
  }, Array.from({ length: workerCount }, () => []))
}

function runBotSearchWorker(game, moveHistory, rootMoveKeys, options = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'chessBotWorker.js'), {
      workerData: {
        fen: game.fen,
        level: game.bot_level,
        moveHistory,
        rootMoveKeys,
      },
    })
    const hardTimeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('Bot search timed out'))
    }, 60000)

    worker.on('message', (message) => {
      if (message.type === 'stats') {
        options.onStats?.(message.stats, options.workerIndex)
        return
      }

      if (message.type === 'bestMove') {
        options.onBestMove?.(message.bestMove, options.workerIndex)
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

async function runBotSearch(game, moveHistory, options = {}) {
  const legalMoves = new Chess(game.fen).moves({ verbose: true })

  if (legalMoves.length === 0) {
    return null
  }

  const profile = getLevelProfile(game.bot_level)
  const maxWorkers = Math.max(1, Math.min(os.cpus().length - 1, profile.workerCount || 1, legalMoves.length))
  const moveGroups = splitMoves(legalMoves, maxWorkers).filter((group) => group.length > 0)
  const startedAt = Date.now()
  const deadlineAt = startedAt + profile.timeLimitMs
  const workerNodes = Array.from({ length: moveGroups.length }, () => 0)
  let currentBestMove = null

  function stats() {
    return {
      workerCount: moveGroups.length,
      nodes: workerNodes.reduce((total, nodes) => total + nodes, 0),
      nodeLimit: profile.nodeLimit * moveGroups.length,
      startedAt,
      deadlineAt,
      timeLimitMs: profile.timeLimitMs,
    }
  }

  const results = await Promise.all(moveGroups.map((rootMoveKeys, workerIndex) => (
    runBotSearchWorker(game, moveHistory, rootMoveKeys, {
      workerIndex,
      onStats: (workerStats, index) => {
        workerNodes[index] = Number(workerStats.nodes || 0)
        options.onBestMove?.({
          ...(currentBestMove || {}),
          stats: stats(),
        })
      },
      onBestMove: (bestMove, index) => {
        workerNodes[index] = Number(bestMove.nodes || 0)

        if (!currentBestMove || Number(bestMove.score ?? -Infinity) > Number(currentBestMove.score ?? -Infinity)) {
          currentBestMove = bestMove
        }

        options.onBestMove?.({
          ...currentBestMove,
          stats: stats(),
        })
      },
    })
  )))

  return results
    .filter(Boolean)
    .sort((a, b) => Number(b.score ?? -Infinity) - Number(a.score ?? -Infinity))[0] || null
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
