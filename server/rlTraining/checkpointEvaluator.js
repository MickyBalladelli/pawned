const { Chess } = require('chess.js')
const { moveToActionIndex } = require('./actionSpace')
const { encodeBoard } = require('./boardEncoding')
const { loadModelFromCheckpoint, readBestCheckpoint, tf, writeBestCheckpoint } = require('./modelStore')

const defaultEvaluationGames = 20
const defaultMaxPlies = 120

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function fenKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ')
}

function materialScore(chess) {
  const values = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
  }
  let score = 0

  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (piece) {
        score += piece.color === 'w' ? values[piece.type] : -values[piece.type]
      }
    }
  }

  return score
}

function predictPolicy(model, chess) {
  return tf.tidy(() => {
    const input = tf.tensor2d([encodeBoard(chess)])
    const [policy] = model.predict(input)

    return policy.arraySync()[0]
  })
}

function selectMove(model, chess, recentPositions, temperature) {
  const legalMoves = chess.moves({ verbose: true })

  if (!legalMoves.length) {
    return null
  }

  if (temperature > 0 && Math.random() < temperature) {
    return randomItem(legalMoves)
  }

  const scores = predictPolicy(model, chess)
  const scoredMoves = legalMoves.map((move) => {
    const nextChess = new Chess(chess.fen())
    nextChess.move(move)

    return {
      move,
      score: (scores[moveToActionIndex(move)] || 0) - (recentPositions.has(fenKey(nextChess.fen())) ? 0.2 : 0),
    }
  })
  const bestScore = Math.max(...scoredMoves.map((move) => move.score))
  const bestMoves = scoredMoves.filter((move) => move.score === bestScore)

  return randomItem(bestMoves).move
}

function scoreCandidateGame(chess, candidateColor) {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'b' : 'w'

    return winner === candidateColor ? 1 : 0
  }

  const material = materialScore(chess)

  if (material === 0) {
    return 0.5
  }

  const whiteAhead = material > 0

  return (candidateColor === 'w' && whiteAhead) || (candidateColor === 'b' && !whiteAhead) ? 0.75 : 0.25
}

function playEvaluationGame(candidateModel, bestModel, candidateColor, maxPlies) {
  const chess = new Chess()
  const recentPositions = new Set([fenKey(chess.fen())])

  for (let ply = 0; ply < maxPlies && !chess.isGameOver(); ply += 1) {
    const isCandidateTurn = chess.turn() === candidateColor
    const model = isCandidateTurn ? candidateModel : bestModel
    const move = selectMove(model, chess, recentPositions, ply < 8 ? 0.15 : 0)

    if (!move) {
      break
    }

    chess.move(move)
    recentPositions.add(fenKey(chess.fen()))
  }

  return scoreCandidateGame(chess, candidateColor)
}

async function evaluateCheckpoint(candidateModel, candidatePath, options = {}) {
  const bestCheckpoint = await readBestCheckpoint()
  const games = options.games || defaultEvaluationGames
  const maxPlies = options.maxPlies || defaultMaxPlies

  if (!bestCheckpoint?.path) {
    await writeBestCheckpoint({
      path: candidatePath,
      reason: 'first checkpoint',
      evaluation: {
        games: 0,
        score: null,
      },
    })

    return {
      promoted: true,
      reason: 'first checkpoint',
      score: null,
      games: 0,
    }
  }

  if (bestCheckpoint.path === candidatePath) {
    return {
      promoted: false,
      reason: 'already best',
      score: null,
      games: 0,
    }
  }

  const bestModel = await loadModelFromCheckpoint(bestCheckpoint.path)
  let score = 0

  try {
    for (let index = 0; index < games; index += 1) {
      score += playEvaluationGame(
        candidateModel,
        bestModel,
        index % 2 === 0 ? 'w' : 'b',
        maxPlies,
      )
    }
  } finally {
    bestModel.dispose()
  }

  const promoted = score > games / 2

  if (promoted) {
    await writeBestCheckpoint({
      path: candidatePath,
      previousBestPath: bestCheckpoint.path,
      reason: 'evaluation win',
      evaluation: {
        games,
        score,
      },
    })
  }

  return {
    promoted,
    reason: promoted ? 'evaluation win' : 'evaluation loss or draw',
    score,
    games,
  }
}

module.exports = {
  evaluateCheckpoint,
}
