const pieceValues = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

export function terminalReward(chess, color) {
  if (!chess.isGameOver()) {
    return 0
  }

  if (chess.isDraw()) {
    return 0
  }

  if (!chess.isCheckmate()) {
    return 0
  }

  const winner = chess.turn() === 'w' ? 'b' : 'w'

  return winner === color ? 1 : -1
}

export function materialBalanceReward(chess, color) {
  const board = chess.board()
  let score = 0

  for (const rank of board) {
    for (const piece of rank) {
      if (!piece) {
        continue
      }

      const value = pieceValues[piece.type]
      score += piece.color === color ? value : -value
    }
  }

  return score / 39
}

export function rewardForPosition(chess, color, options = {}) {
  const terminalWeight = options.terminalWeight ?? 1
  const materialWeight = options.materialWeight ?? 0.05

  return (
    terminalReward(chess, color) * terminalWeight +
    materialBalanceReward(chess, color) * materialWeight
  )
}

export function finalRewards(chess) {
  return {
    w: terminalReward(chess, 'w'),
    b: terminalReward(chess, 'b'),
  }
}
