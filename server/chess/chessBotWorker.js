const { parentPort, workerData } = require('worker_threads')
const { Chess } = require('chess.js')
const { chooseBotMove } = require('./chessBot')

async function run() {
  const chess = new Chess(workerData.fen)
  const rootMoveKeys = new Set(workerData.rootMoveKeys || [])
  const firstMove = chess.moves({ verbose: true }).find((move) => (
    rootMoveKeys.size === 0 || rootMoveKeys.has(`${move.from}${move.to}${move.promotion || ''}`)
  ))

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
    rootMoveKeys: workerData.rootMoveKeys,
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
