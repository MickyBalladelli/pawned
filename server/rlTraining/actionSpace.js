const promotionPieces = ['', 'q', 'r', 'b', 'n']
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const actionCount = 64 * 64 * promotionPieces.length

function squareIndex(square) {
  const file = files.indexOf(square[0])
  const rank = Number(square[1]) - 1

  return rank * 8 + file
}

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

function moveToActionIndex(move) {
  const promotionIndex = Math.max(0, promotionPieces.indexOf(move.promotion || ''))

  return ((squareIndex(move.from) * 64) + squareIndex(move.to)) * promotionPieces.length + promotionIndex
}

module.exports = {
  actionCount,
  moveToActionIndex,
  moveToUci,
}
