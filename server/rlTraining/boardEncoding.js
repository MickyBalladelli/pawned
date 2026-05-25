const piecePlanes = {
  wp: 0,
  wn: 1,
  wb: 2,
  wr: 3,
  wq: 4,
  wk: 5,
  bp: 6,
  bn: 7,
  bb: 8,
  br: 9,
  bq: 10,
  bk: 11,
}

const inputSize = 8 * 8 * 18

function castlingRightsFromFen(fen) {
  const rights = fen.split(' ')[2] || '-'

  return {
    whiteKing: rights.includes('K'),
    whiteQueen: rights.includes('Q'),
    blackKing: rights.includes('k'),
    blackQueen: rights.includes('q'),
  }
}

function squareOffset(square) {
  const file = square.charCodeAt(0) - 97
  const rank = 8 - Number(square[1])

  return (rank * 8 + file) * 18
}

function encodeBoard(chess) {
  const data = Array(inputSize).fill(0)
  const board = chess.board()
  const fen = chess.fen()
  const turnValue = chess.turn() === 'w' ? 1 : 0
  const castling = castlingRightsFromFen(fen)
  const enPassantSquare = fen.split(' ')[3]

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const offset = (rank * 8 + file) * 18
      const piece = board[rank][file]

      if (piece) {
        data[offset + piecePlanes[`${piece.color}${piece.type}`]] = 1
      }

      data[offset + 12] = turnValue
      data[offset + 13] = castling.whiteKing ? 1 : 0
      data[offset + 14] = castling.whiteQueen ? 1 : 0
      data[offset + 15] = castling.blackKing ? 1 : 0
      data[offset + 16] = castling.blackQueen ? 1 : 0
    }
  }

  if (enPassantSquare && enPassantSquare !== '-') {
    data[squareOffset(enPassantSquare) + 17] = 1
  }

  return data
}

module.exports = {
  encodeBoard,
  inputSize,
}
