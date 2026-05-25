const pieceValues = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

function materialBalance(chess, color) {
  let score = 0

  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (!piece) {
        continue
      }

      score += piece.color === color ? pieceValues[piece.type] : -pieceValues[piece.type]
    }
  }

  return score / 39
}

function outcomeValue(chess, color, hitMaxPlies) {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'b' : 'w'
    return winner === color ? 1 : -1
  }

  if (chess.isDraw()) {
    return 0
  }

  if (hitMaxPlies) {
    return materialBalance(chess, color) * 0.25
  }

  return 0
}

module.exports = {
  outcomeValue,
}
