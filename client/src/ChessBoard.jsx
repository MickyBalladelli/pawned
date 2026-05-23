import { Box } from '@mui/material'
import { Chessboard, defaultPieces } from 'react-chessboard'

const readablePieces = Object.fromEntries(
  Object.entries(defaultPieces).map(([piece, Piece]) => [
    piece,
    (props) => (
      <Piece
        {...props}
        fill={piece.startsWith('w') ? '#fff7d6' : '#20150d'}
        svgStyle={{
          filter: piece.startsWith('w')
            ? 'drop-shadow(0 1px 0 #111827) drop-shadow(0 2px 2px rgba(0,0,0,0.45))'
            : 'drop-shadow(0 1px 1px rgba(255,255,255,0.26))',
          ...props?.svgStyle,
        }}
      />
    ),
  ]),
)

function ChessBoard({
  onSquareClick,
  playerColor,
  position,
  selectedSquare,
  themeMode,
}) {
  return (
    <Box sx={{ width: '100%', maxWidth: 520, mx: { xs: 'auto', xl: 0 } }}>
      <Chessboard
        options={{
          id: 'vela-chessboard',
          position,
          pieces: readablePieces,
          boardOrientation: playerColor === 'black' ? 'black' : 'white',
          allowDragging: false,
          showNotation: true,
          darkSquareStyle: {
            backgroundColor: themeMode === 'dark' ? '#64748b' : '#8ab391',
          },
          lightSquareStyle: {
            backgroundColor: themeMode === 'dark' ? '#e5e7eb' : '#f0d9b5',
          },
          squareStyles: selectedSquare
            ? {
                [selectedSquare]: {
                  backgroundColor: '#fbbf24',
                  boxShadow: 'inset 0 0 0 4px rgba(17, 24, 39, 0.42)',
                },
              }
            : {},
          boardStyle: {
            border: '1px solid rgba(148, 163, 184, 0.55)',
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)',
          },
          onSquareClick: ({ square }) => onSquareClick(square),
        }}
      />
    </Box>
  )
}

export default ChessBoard
