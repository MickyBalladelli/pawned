const { parentPort, workerData } = require('worker_threads')
const { Chess } = require('chess.js')
const { chooseBotMove } = require('./chessBot')

async function run() {
  const chess = new Chess(workerData.fen)
  const firstMove = chess.moves({ verbose: true })[0]

  if (firstMove) {
    parentPort.postMessage({
      type: 'bestMove',
      bestMove: {
        from: firstMove.from,
        to: firstMove.to,
        promotion: firstMove.promotion || null,
        depth: 0,
        nodes: 0,
        score: null,
      },
    })
  }

  const move = await chooseBotMove(chess, workerData.moveHistory, workerData.level, {
    onBestMove: (bestMove) => {
      parentPort.postMessage({
        type: 'bestMove',
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
  })

  parentPort.postMessage({
    type: 'done',
    move,
  })
}

run().catch((err) => {
  parentPort.postMessage({
    type: 'error',
    error: err.message || 'Bot search failed',
  })
})
