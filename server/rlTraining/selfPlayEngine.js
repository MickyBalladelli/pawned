const { Chess } = require('chess.js')
const { moveToActionIndex, moveToUci } = require('./actionSpace')
const { encodeBoard } = require('./boardEncoding')
const { outcomeValue } = require('./rewards')
const { tf } = require('./modelStore')

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function chooseMoveWithModel(model, chess, explorationRate) {
  const legalMoves = chess.moves({ verbose: true })

  if (!model || Math.random() < explorationRate) {
    return randomItem(legalMoves)
  }

  const state = encodeBoard(chess)
  const legalIndexes = legalMoves.map(moveToActionIndex)
  const scores = tf.tidy(() => {
    const input = tf.tensor2d([state])
    const [policy] = model.predict(input)

    return policy.dataSync()
  })

  let bestMove = legalMoves[0]
  let bestScore = -Infinity

  for (let index = 0; index < legalMoves.length; index += 1) {
    const score = scores[legalIndexes[index]]

    if (score > bestScore) {
      bestScore = score
      bestMove = legalMoves[index]
    }
  }

  return bestMove
}

function playSelfPlayGame(model, options = {}) {
  const chess = new Chess()
  const maxPlies = options.maxPlies || 400
  const explorationRate = options.explorationRate ?? 0.25
  const samples = []
  const moves = []

  while (!chess.isGameOver() && moves.length < maxPlies) {
    const color = chess.turn()
    const state = encodeBoard(chess)
    const move = chooseMoveWithModel(model, chess, explorationRate)

    chess.move(move)

    const moveRecord = {
      ply: moves.length + 1,
      moveNumber: Math.ceil((moves.length + 1) / 2),
      color: move.color === 'w' ? 'white' : 'black',
      san: move.san,
      uci: moveToUci(move),
      fen: chess.fen(),
    }

    moves.push(moveRecord)
    samples.push({
      state,
      action: moveToActionIndex(move),
      color,
      fen: moveRecord.fen,
    })
  }

  const hitMaxPlies = moves.length >= maxPlies && !chess.isGameOver()
  const game = {
    id: `game-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    initialFen: new Chess().fen(),
    currentFen: chess.fen(),
    result: chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : hitMaxPlies ? 'max plies' : 'in progress',
    hitMaxPlies,
    moves,
  }

  return {
    game,
    samples: samples.map((sample) => ({
      ...sample,
      value: outcomeValue(chess, sample.color, hitMaxPlies),
      gameId: game.id,
    })),
  }
}

module.exports = {
  playSelfPlayGame,
}
