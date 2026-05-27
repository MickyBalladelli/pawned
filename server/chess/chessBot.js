const openingBook = require('../../client/src/data/chessOpenings.json')

const botLevels = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000]
const pieceValues = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

const pieceSquareTables = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 5, 5, 0, 0, 0,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    5, 10, 10, 10, 10, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -10, 5, 5, 5, 5, 5, 0, -10,
    0, 0, 5, 5, 5, 5, 0, -5,
    -5, 0, 5, 5, 5, 5, 0, -5,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    20, 30, 10, 0, 0, 10, 30, 20,
    20, 20, 0, 0, 0, 0, 20, 20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
  ],
}

const levelProfiles = {
  600: { depth: 1, maxBranch: 8, openingChance: 0.55, blunderChance: 0.34, randomTop: 8, noise: 90 },
  800: { depth: 1, maxBranch: 10, openingChance: 0.65, blunderChance: 0.24, randomTop: 6, noise: 65 },
  1000: { depth: 2, maxBranch: 12, openingChance: 0.72, blunderChance: 0.16, randomTop: 5, noise: 45 },
  1200: { depth: 2, maxBranch: 14, openingChance: 0.8, blunderChance: 0.1, randomTop: 4, noise: 30 },
  1400: { depth: 2, maxBranch: 16, openingChance: 0.86, blunderChance: 0.06, randomTop: 3, noise: 18 },
  1600: { depth: 3, maxBranch: 12, openingChance: 0.9, blunderChance: 0.03, randomTop: 2, noise: 10 },
  1800: { depth: 3, maxBranch: 14, openingChance: 0.92, blunderChance: 0.015, randomTop: 2, noise: 5 },
  2000: { depth: 3, maxBranch: 16, openingChance: 0.94, blunderChance: 0.005, randomTop: 1, noise: 0 },
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

function tableIndex(rank, file, color) {
  return color === 'w' ? rank * 8 + file : (7 - rank) * 8 + file
}

function endgameWeight(board) {
  let nonPawnMaterial = 0

  for (const rank of board) {
    for (const piece of rank) {
      if (piece && piece.type !== 'p' && piece.type !== 'k') {
        nonPawnMaterial += pieceValues[piece.type] || 0
      }
    }
  }

  return Math.max(0, 1 - nonPawnMaterial / 6000)
}

function pawnShieldScore(board, rank, file, color) {
  const pawnRank = color === 'w' ? rank - 1 : rank + 1

  if (pawnRank < 0 || pawnRank > 7) {
    return 0
  }

  let score = 0

  for (let shieldFile = file - 1; shieldFile <= file + 1; shieldFile += 1) {
    const piece = board[pawnRank]?.[shieldFile]

    if (piece?.type === 'p' && piece.color === color) {
      score += 12
    }
  }

  return score
}

function kingEndgameActivity(rank, file) {
  const centerDistance = Math.abs(file - 3.5) + Math.abs(rank - 3.5)

  return Math.max(0, 28 - centerDistance * 8)
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
  const endgame = endgameWeight(board)

  for (let rank = 0; rank < board.length; rank += 1) {
    for (let file = 0; file < board[rank].length; file += 1) {
      const piece = board[rank][file]

      if (!piece) {
        continue
      }

      const value = pieceValues[piece.type] || 0
      const table = pieceSquareTables[piece.type] || []
      const tableScore = table[tableIndex(rank, file, piece.color)] || 0
      const kingSafety = piece.type === 'k'
        ? pawnShieldScore(board, rank, file, piece.color) * (1 - endgame) + kingEndgameActivity(rank, file) * endgame
        : 0
      const signed = piece.color === 'w' ? 1 : -1
      score += signed * (value + tableScore + kingSafety)
    }
  }

  if (chess.inCheck()) {
    score += chess.turn() === 'w' ? -35 : 35
  }

  const mobility = chess.moves({ verbose: true }).length
  score += chess.turn() === 'w' ? mobility * 2 : -mobility * 2

  return botColor === 'white' ? score : -score
}

function moveOrderScore(move) {
  let score = 0

  if (move.san?.includes('#')) {
    score += 100000
  } else if (move.san?.includes('+')) {
    score += 500
  }

  if (move.captured) {
    score += (pieceValues[move.captured] || 0) * 10 - (pieceValues[move.piece] || 0)
  }

  if (move.promotion) {
    score += pieceValues[move.promotion] || 0
  }

  if (['d4', 'd5', 'e4', 'e5'].includes(move.to)) {
    score += 25
  }

  return score
}

function getOrderedMoves(chess) {
  return chess.moves({ verbose: true }).sort((a, b) => moveOrderScore(b) - moveOrderScore(a))
}

function search(chess, depth, botColor, maxBranch, alpha = -Infinity, beta = Infinity) {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess, botColor)
  }

  const sideToMove = chess.turn() === 'w' ? 'white' : 'black'
  const maximizing = sideToMove === botColor
  const moves = getOrderedMoves(chess).slice(0, maxBranch)

  if (maximizing) {
    let best = -Infinity

    for (const move of moves) {
      chess.move(move)
      const score = search(chess, depth - 1, botColor, maxBranch, alpha, beta)
      chess.undo()
      best = Math.max(best, score)
      alpha = Math.max(alpha, score)

      if (alpha >= beta) {
        break
      }
    }

    return best
  }

  let best = Infinity

  for (const move of moves) {
    chess.move(move)
    const score = search(chess, depth - 1, botColor, maxBranch, alpha, beta)
    chess.undo()
    best = Math.min(best, score)
    beta = Math.min(beta, score)

    if (alpha >= beta) {
      break
    }
  }

  return best
}

function bestOpponentCaptureValue(chess) {
  return chess.moves({ verbose: true }).reduce((best, move) => {
    if (!move.captured) {
      return best
    }

    return Math.max(best, (pieceValues[move.captured] || 0) - (pieceValues[move.piece] || 0) * 0.15)
  }, 0)
}

function scoreMove(chess, move, botColor, profile) {
  const before = evaluateBoard(chess, botColor)

  chess.move(move)

  let score = chess.isCheckmate()
    ? 100000
    : search(chess, profile.depth - 1, botColor, profile.maxBranch)
  const after = evaluateBoard(chess, botColor)
  const danger = bestOpponentCaptureValue(chess)

  score += (after - before) * 0.25
  score -= danger * 0.55

  if (move.captured) {
    score += (pieceValues[move.captured] || 0) * 0.35
  }

  if (move.san?.includes('+')) {
    score += 30
  }

  if (move.flags?.includes('k') || move.flags?.includes('q')) {
    score += 45
  }

  if (move.promotion) {
    score += pieceValues[move.promotion] || 0
  }

  chess.undo()

  if (profile.noise) {
    score += (Math.random() - 0.5) * profile.noise
  }

  return score
}

function chooseUtilityMove(chess, level) {
  const profile = getLevelProfile(level)
  const botColor = chess.turn() === 'w' ? 'white' : 'black'
  const moves = getOrderedMoves(chess).slice(0, profile.maxBranch)
  const scoredMoves = moves.map((move) => ({
    move,
    score: scoreMove(chess, move, botColor, profile),
  })).sort((a, b) => b.score - a.score)

  if (scoredMoves.length === 0) {
    return null
  }

  const winningMove = scoredMoves.find((item) => item.move.san?.includes('#'))

  if (winningMove) {
    return winningMove.move
  }

  const topCount = Math.min(profile.randomTop, scoredMoves.length)
  const blunderCount = Math.min(scoredMoves.length, Math.max(topCount, topCount + 4))
  const pool = Math.random() < profile.blunderChance
    ? scoredMoves.slice(topCount, blunderCount)
    : scoredMoves.slice(0, topCount)
  const safePool = pool.length > 0 ? pool : scoredMoves.slice(0, topCount)

  return safePool[Math.floor(Math.random() * safePool.length)].move
}

function chooseSearchMove(chess, level) {
  return chooseUtilityMove(chess, level)
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
    source: 'utility-search',
  }
}

module.exports = {
  botLevels,
  normalizeBotLevel,
  openingBook,
  getOpeningMatches,
  chooseBotMove,
}
