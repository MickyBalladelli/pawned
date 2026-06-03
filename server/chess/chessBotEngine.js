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

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const mateScore = 1000000
const infinity = 100000000
const timeout = Symbol('timeout')

function tableIndex(rank, file, color) {
  return color === 'w' ? rank * 8 + file : (7 - rank) * 8 + file
}

function moveKey(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

function positionKey(chess) {
  return chess.fen().split(' ').slice(0, 4).join(' ')
}

function squareName(rank, file) {
  return `${files[file]}${8 - rank}`
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
      score += 14
    }
  }

  return score
}

function kingEndgameActivity(rank, file) {
  const centerDistance = Math.abs(file - 3.5) + Math.abs(rank - 3.5)

  return Math.max(0, 32 - centerDistance * 8)
}

function pawnStructureScore(board, rank, file, color) {
  let sameFilePawns = 0
  let friendlyAdjacentPawns = 0
  let blockingEnemyPawns = 0
  const direction = color === 'w' ? -1 : 1

  for (let scanRank = 0; scanRank < 8; scanRank += 1) {
    const sameFilePiece = board[scanRank]?.[file]

    if (sameFilePiece?.type === 'p' && sameFilePiece.color === color) {
      sameFilePawns += 1
    }

    for (const adjacentFile of [file - 1, file + 1]) {
      const adjacentPiece = board[scanRank]?.[adjacentFile]

      if (adjacentPiece?.type === 'p' && adjacentPiece.color === color) {
        friendlyAdjacentPawns += 1
      }
    }
  }

  for (let scanRank = rank + direction; scanRank >= 0 && scanRank < 8; scanRank += direction) {
    for (const scanFile of [file - 1, file, file + 1]) {
      const piece = board[scanRank]?.[scanFile]

      if (piece?.type === 'p' && piece.color !== color) {
        blockingEnemyPawns += 1
      }
    }
  }

  const advance = color === 'w' ? 6 - rank : rank - 1
  let score = Math.max(0, advance) * 4

  if (sameFilePawns > 1) {
    score -= 18 * (sameFilePawns - 1)
  }

  if (friendlyAdjacentPawns === 0) {
    score -= 14
  }

  if (blockingEnemyPawns === 0) {
    score += 22 + Math.max(0, advance) * 8
  }

  return score
}

function filePawnCounts(board, file, color) {
  let count = 0

  for (let rank = 0; rank < 8; rank += 1) {
    const piece = board[rank]?.[file]

    if (piece?.type === 'p' && piece.color === color) {
      count += 1
    }
  }

  return count
}

function rookFileScore(board, file, color) {
  const friendlyPawns = filePawnCounts(board, file, color)
  const enemyPawns = filePawnCounts(board, file, color === 'w' ? 'b' : 'w')

  if (friendlyPawns === 0 && enemyPawns === 0) {
    return 28
  }

  if (friendlyPawns === 0) {
    return 14
  }

  return 0
}

function attackedPieceScore(chess, square, piece) {
  const enemyColor = piece.color === 'w' ? 'b' : 'w'
  const isAttacked = chess.isAttacked(square, enemyColor)

  if (!isAttacked) {
    return 0
  }

  const isDefended = chess.isAttacked(square, piece.color)
  const value = pieceValues[piece.type] || 0

  if (!isDefended) {
    return -Math.min(220, value * 0.45)
  }

  return -Math.min(80, value * 0.14)
}

function kingDangerScore(chess, rank, file, color) {
  const enemyColor = color === 'w' ? 'b' : 'w'
  let danger = 0

  for (let scanRank = rank - 1; scanRank <= rank + 1; scanRank += 1) {
    for (let scanFile = file - 1; scanFile <= file + 1; scanFile += 1) {
      if (scanRank < 0 || scanRank > 7 || scanFile < 0 || scanFile > 7) {
        continue
      }

      if (chess.isAttacked(squareName(scanRank, scanFile), enemyColor)) {
        danger += 10
      }
    }
  }

  return -danger
}

function evaluateBoard(chess, botColor) {
  if (chess.isCheckmate()) {
    return chess.turn() === botColor ? -mateScore : mateScore
  }

  if (chess.isDraw() || chess.isGameOver()) {
    return 0
  }

  let score = 0
  const board = chess.board()
  const endgame = endgameWeight(board)
  const pieceCounts = {
    w: { b: 0 },
    b: { b: 0 },
  }

  for (let rank = 0; rank < board.length; rank += 1) {
    for (let file = 0; file < board[rank].length; file += 1) {
      const piece = board[rank][file]

      if (!piece) {
        continue
      }

      const value = pieceValues[piece.type] || 0
      const table = pieceSquareTables[piece.type] || []
      const tableScore = table[tableIndex(rank, file, piece.color)] || 0
      const square = squareName(rank, file)
      const pawnScore = piece.type === 'p' ? pawnStructureScore(board, rank, file, piece.color) : 0
      const rookScore = piece.type === 'r' ? rookFileScore(board, file, piece.color) : 0
      const attackedScore = attackedPieceScore(chess, square, piece)
      const kingScore = piece.type === 'k'
        ? pawnShieldScore(board, rank, file, piece.color) * (1 - endgame) +
          kingEndgameActivity(rank, file) * endgame +
          kingDangerScore(chess, rank, file, piece.color) * (1 - endgame)
        : 0
      const signed = piece.color === botColor ? 1 : -1

      if (piece.type === 'b') {
        pieceCounts[piece.color].b += 1
      }

      score += signed * (value + tableScore + pawnScore + rookScore + attackedScore + kingScore)
    }
  }

  if (pieceCounts[botColor].b >= 2) {
    score += 35
  }

  if (pieceCounts[botColor === 'w' ? 'b' : 'w'].b >= 2) {
    score -= 35
  }

  const sideToMove = chess.turn()
  const mobility = chess.moves({ verbose: true }).length
  score += sideToMove === botColor ? mobility * 2 : -mobility * 2

  if (chess.inCheck()) {
    score += sideToMove === botColor ? -45 : 45
  }

  return score
}

function moveOrderScore(move, state, ply) {
  let score = state.bestMoveKey === moveKey(move) ? 2000000 : 0

  if (move.san?.includes('#')) {
    score += 1000000
  } else if (move.san?.includes('+')) {
    score += 45000
  }

  if (move.captured) {
    score += 100000 + (pieceValues[move.captured] || 0) * 10 - (pieceValues[move.piece] || 0)
  }

  if (move.promotion) {
    score += 80000 + (pieceValues[move.promotion] || 0)
  }

  if (state.killers[ply]?.has(moveKey(move))) {
    score += 60000
  }

  score += state.history.get(moveKey(move)) || 0

  if (['d4', 'd5', 'e4', 'e5'].includes(move.to)) {
    score += 100
  }

  return score
}

function orderedMoves(chess, state, ply) {
  return chess.moves({ verbose: true }).sort((a, b) => {
    return moveOrderScore(b, state, ply) - moveOrderScore(a, state, ply)
  })
}

function tacticalMoves(chess) {
  return chess.moves({ verbose: true })
    .filter((move) => move.captured || move.promotion || move.san?.includes('+'))
    .sort((a, b) => {
      return (pieceValues[b.captured] || 0) - (pieceValues[a.captured] || 0)
    })
}

function rememberKiller(state, ply, move) {
  if (move.captured) {
    return
  }

  if (!state.killers[ply]) {
    state.killers[ply] = new Set()
  }

  state.killers[ply].add(moveKey(move))
}

function rememberHistory(state, depth, move) {
  const key = moveKey(move)
  state.history.set(key, (state.history.get(key) || 0) + depth * depth)
}

function checkLimits(state) {
  state.nodes += 1

  if (state.nodes >= state.nodeLimit || Date.now() >= state.deadline) {
    throw timeout
  }
}

function transpositionLookup(state, key, depth, alpha, beta) {
  const entry = state.table.get(key)

  if (!entry || entry.depth < depth) {
    return null
  }

  if (entry.flag === 'exact') {
    return entry.score
  }

  if (entry.flag === 'lower' && entry.score >= beta) {
    return entry.score
  }

  if (entry.flag === 'upper' && entry.score <= alpha) {
    return entry.score
  }

  return null
}

function storeTransposition(state, key, depth, score, alpha, beta, bestMove) {
  let flag = 'exact'

  if (score <= alpha) {
    flag = 'upper'
  } else if (score >= beta) {
    flag = 'lower'
  }

  state.table.set(key, {
    depth,
    score,
    flag,
    bestMoveKey: bestMove ? moveKey(bestMove) : null,
  })
}

function quiescence(chess, alpha, beta, botColor, state, ply) {
  checkLimits(state)

  const sideSign = chess.turn() === botColor ? 1 : -1
  const standPat = evaluateBoard(chess, botColor) * sideSign

  if (standPat >= beta) {
    return beta
  }

  let best = standPat
  let localAlpha = Math.max(alpha, standPat)

  for (const move of tacticalMoves(chess)) {
    chess.move(move)
    let score

    try {
      score = -quiescence(chess, -beta, -localAlpha, botColor, state, ply + 1)
    } finally {
      chess.undo()
    }

    if (score > best) {
      best = score
    }

    if (score > localAlpha) {
      localAlpha = score
    }

    if (localAlpha >= beta) {
      break
    }
  }

  return best
}

function negamax(chess, depth, alpha, beta, botColor, state, ply) {
  checkLimits(state)

  if (chess.isCheckmate()) {
    return -mateScore + ply
  }

  if (chess.isDraw() || chess.isGameOver()) {
    return 0
  }

  const extension = chess.inCheck() && ply < 14 ? 1 : 0
  const effectiveDepth = depth + extension

  if (effectiveDepth === 0) {
    return quiescence(chess, alpha, beta, botColor, state, ply)
  }

  const key = positionKey(chess)
  const entry = state.table.get(key)
  const cached = transpositionLookup(state, key, effectiveDepth, alpha, beta)

  if (cached !== null) {
    return cached
  }

  const previousBestMoveKey = state.bestMoveKey
  state.bestMoveKey = entry?.bestMoveKey || null

  let bestMove = null
  let bestScore = -infinity
  const originalAlpha = alpha
  const moves = orderedMoves(chess, state, ply)

  for (const move of moves) {
    chess.move(move)
    let score

    try {
      score = -negamax(chess, effectiveDepth - 1, -beta, -alpha, botColor, state, ply + 1)
    } finally {
      chess.undo()
    }

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }

    if (score > alpha) {
      alpha = score
    }

    if (alpha >= beta) {
      rememberKiller(state, ply, move)
      rememberHistory(state, effectiveDepth, move)
      break
    }
  }

  state.bestMoveKey = previousBestMoveKey
  storeTransposition(state, key, effectiveDepth, bestScore, originalAlpha, beta, bestMove)

  return bestScore
}

function searchRoot(chess, depth, botColor, state) {
  let bestMove = null
  let bestScore = -infinity
  let alpha = -infinity
  const moves = orderedMoves(chess, state, 0)

  for (const move of moves) {
    chess.move(move)
    let score

    try {
      score = -negamax(chess, depth - 1, -infinity, -alpha, botColor, state, 1)
    } finally {
      chess.undo()
    }

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }

    if (score > alpha) {
      alpha = score
    }
  }

  return { move: bestMove, score: bestScore }
}

function chooseEngineMove(chess, options = {}) {
  const moves = chess.moves({ verbose: true })

  if (moves.length === 0) {
    return null
  }

  const botColor = chess.turn()
  const state = {
    deadline: Date.now() + (options.timeLimitMs || 900),
    nodeLimit: options.nodeLimit || 250000,
    nodes: 0,
    table: new Map(),
    killers: [],
    history: new Map(),
    bestMoveKey: null,
  }
  const maxDepth = options.maxDepth || 5
  let best = { move: moves[0], score: -infinity, depth: 0 }

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    try {
      const result = searchRoot(chess, depth, botColor, state)

      if (result.move) {
        best = { ...result, depth }
        state.bestMoveKey = moveKey(result.move)
      }
    } catch (err) {
      if (err !== timeout) {
        throw err
      }

      break
    }
  }

  return {
    ...best.move,
    score: best.score,
    depth: best.depth,
    nodes: state.nodes,
  }
}

module.exports = {
  chooseEngineMove,
  evaluateBoard,
}
