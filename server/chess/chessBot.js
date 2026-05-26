const openingBook = require('../../client/src/data/chessOpenings.json')

const trainedBotLevel = 5
const botLevels = [600, 800, 1000, 1200, 1400, 1600, trainedBotLevel]
const pieceValues = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

const levelProfiles = {
  600: { depth: 1, openingChance: 0.55, blunderChance: 0.34, randomTop: 8 },
  800: { depth: 1, openingChance: 0.65, blunderChance: 0.24, randomTop: 6 },
  1000: { depth: 2, openingChance: 0.72, blunderChance: 0.16, randomTop: 5 },
  1200: { depth: 2, openingChance: 0.8, blunderChance: 0.1, randomTop: 4 },
  1400: { depth: 2, openingChance: 0.86, blunderChance: 0.06, randomTop: 3 },
  1600: { depth: 3, openingChance: 0.9, blunderChance: 0.03, randomTop: 2 },
  [trainedBotLevel]: { depth: 3, openingChance: 0.9, blunderChance: 0.03, randomTop: 2 },
}

function normalizeBotLevel(level) {
  const numericLevel = Number(level)

  if (botLevels.includes(numericLevel)) {
    return numericLevel
  }

  return 800
}

function getLevelProfile(level) {
  return levelProfiles[normalizeBotLevel(level)]
}

function getOpeningMatches(history) {
  return openingBook.openings.filter((opening) => {
    if (history.length >= opening.moves.length) {
      return false
    }

    return history.every((move, index) => opening.moves[index] === move)
  })
}

function findOpeningMove(chess, history) {
  const legalSans = new Set(chess.moves())
  const matches = getOpeningMatches(history)
  const candidates = matches
    .map((opening) => ({
      opening,
      san: opening.moves[history.length],
    }))
    .filter((candidate) => legalSans.has(candidate.san))

  if (candidates.length === 0) {
    return null
  }

  return candidates[Math.floor(Math.random() * candidates.length)]
}

function evaluateBoard(chess, botColor) {
  if (chess.isCheckmate()) {
    const sideToMove = chess.turn() === 'w' ? 'white' : 'black'
    return sideToMove === botColor ? -100000 : 100000
  }

  if (chess.isDraw() || chess.isGameOver()) {
    return 0
  }

  let score = 0
  const board = chess.board()

  for (let rank = 0; rank < board.length; rank += 1) {
    for (let file = 0; file < board[rank].length; file += 1) {
      const piece = board[rank][file]

      if (!piece) {
        continue
      }

      const value = pieceValues[piece.type] || 0
      const advancement = piece.color === 'w' ? 7 - rank : rank
      const centerDistance = Math.abs(file - 3.5) + Math.abs(rank - 3.5)
      const positional = piece.type === 'p'
        ? advancement * 6
        : Math.max(0, 20 - centerDistance * 4)
      const signed = piece.color === 'w' ? 1 : -1
      score += signed * (value + positional)
    }
  }

  if (chess.inCheck()) {
    score += chess.turn() === 'w' ? -35 : 35
  }

  return botColor === 'white' ? score : -score
}

function negamax(chess, depth, botColor, alpha = -Infinity, beta = Infinity) {
  if (depth === 0 || chess.isGameOver()) {
    const sideToMove = chess.turn() === 'w' ? 'white' : 'black'
    const perspective = sideToMove === botColor ? 1 : -1
    return perspective * evaluateBoard(chess, botColor)
  }

  let best = -Infinity
  const moves = chess.moves({ verbose: true })

  for (const move of moves) {
    chess.move(move)
    const score = -negamax(chess, depth - 1, botColor, -beta, -alpha)
    chess.undo()
    best = Math.max(best, score)
    alpha = Math.max(alpha, score)

    if (alpha >= beta) {
      break
    }
  }

  return best
}

function chooseSearchMove(chess, level) {
  const profile = getLevelProfile(level)
  const botColor = chess.turn() === 'w' ? 'white' : 'black'
  const moves = chess.moves({ verbose: true })
  const scoredMoves = moves.map((move) => {
    chess.move(move)
    const score = -negamax(chess, profile.depth - 1, botColor)
    chess.undo()

    return { move, score }
  }).sort((a, b) => b.score - a.score)

  if (scoredMoves.length === 0) {
    return null
  }

  const topCount = Math.min(profile.randomTop, scoredMoves.length)
  const blunderCount = Math.min(scoredMoves.length, Math.max(topCount, topCount + 4))
  const pool = Math.random() < profile.blunderChance
    ? scoredMoves.slice(topCount, blunderCount)
    : scoredMoves.slice(0, topCount)
  const safePool = pool.length > 0 ? pool : scoredMoves.slice(0, topCount)

  return safePool[Math.floor(Math.random() * safePool.length)].move
}

function chooseBotMove(chess, moveHistory, level) {
  const profile = getLevelProfile(level)
  const openingCandidate = (moveHistory.length < 2 || Math.random() < profile.openingChance)
    ? findOpeningMove(chess, moveHistory)
    : null

  if (openingCandidate) {
    const move = chess.move(openingCandidate.san)
    chess.undo()

    return {
      from: move.from,
      to: move.to,
      promotion: move.promotion || undefined,
      source: 'opening',
      opening: openingCandidate.opening,
    }
  }

  const searchMove = chooseSearchMove(chess, level)

  if (!searchMove) {
    return null
  }

  return {
    from: searchMove.from,
    to: searchMove.to,
    promotion: searchMove.promotion || undefined,
    source: 'search',
  }
}

module.exports = {
  botLevels,
  trainedBotLevel,
  normalizeBotLevel,
  openingBook,
  getOpeningMatches,
  chooseBotMove,
}
