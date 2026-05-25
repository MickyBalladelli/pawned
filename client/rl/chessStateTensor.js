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

const planeCount = 18

function emptyBoardTensor() {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array(planeCount).fill(0))
  )
}

function squareToIndexes(square) {
  const file = square.charCodeAt(0) - 97
  const rank = 8 - Number(square[1])

  return { rank, file }
}

function castlingRightsFromFen(fen) {
  const rights = fen.split(' ')[2] || '-'

  return {
    whiteKing: rights.includes('K'),
    whiteQueen: rights.includes('Q'),
    blackKing: rights.includes('k'),
    blackQueen: rights.includes('q'),
  }
}

export function encodeBoardState(chess) {
  const encoded = emptyBoardTensor()
  const board = chess.board()
  const fen = chess.fen()
  const turnPlaneValue = chess.turn() === 'w' ? 1 : 0
  const castling = castlingRightsFromFen(fen)
  const enPassantSquare = fen.split(' ')[3]

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file]

      if (piece) {
        encoded[rank][file][piecePlanes[`${piece.color}${piece.type}`]] = 1
      }

      encoded[rank][file][12] = turnPlaneValue
      encoded[rank][file][13] = castling.whiteKing ? 1 : 0
      encoded[rank][file][14] = castling.whiteQueen ? 1 : 0
      encoded[rank][file][15] = castling.blackKing ? 1 : 0
      encoded[rank][file][16] = castling.blackQueen ? 1 : 0
    }
  }

  if (enPassantSquare && enPassantSquare !== '-') {
    const { rank, file } = squareToIndexes(enPassantSquare)
    encoded[rank][file][17] = 1
  }

  return encoded
}

export function boardTensorShape() {
  return [8, 8, planeCount]
}

export function createBoardTensor(tf, chess) {
  return tf.tensor(encodeBoardState(chess), boardTensorShape())
}

export function legalMovesAsUci(chess) {
  return chess.moves({ verbose: true }).map((move) => {
    const promotion = move.promotion || ''

    return `${move.from}${move.to}${promotion}`
  })
}
