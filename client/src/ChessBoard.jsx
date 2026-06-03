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
  boardOrientation,
  lastMoveSquares = [],
  onSquareClick,
  playerColor,
  position,
  selectedSquare,
  thinkingMoveSquares = [],
  themeMode,
}) {
  const moveSquareStyles = Object.fromEntries(
    lastMoveSquares.map((square) => [
      square,
      {
        backgroundColor: '#fef3c7',
        boxShadow: 'inset 0 0 0 3px rgba(217, 119, 6, 0.22)',
      },
    ]),
  )
  const selectedSquareStyles = selectedSquare
    ? {
        [selectedSquare]: {
          backgroundColor: '#fbbf24',
          boxShadow: 'inset 0 0 0 4px rgba(17, 24, 39, 0.42)',
        },
      }
    : {}
  const thinkingSquareStyles = Object.fromEntries(
    thinkingMoveSquares.map((square) => [
      square,
      {
        backgroundColor: '#bfdbfe',
        boxShadow: 'inset 0 0 0 3px rgba(37, 99, 235, 0.32)',
      },
    ]),
  )

  function handleSquareClick(square) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    onSquareClick(square)
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 520,
        mx: { xs: 'auto', lg: 0 },
        userSelect: 'none',
        caretColor: 'transparent',
        '& *': {
          userSelect: 'none',
          caretColor: 'transparent',
        },
        '& [contenteditable="true"]': {
          caretColor: 'transparent',
        },
      }}
    >
      <Chessboard
        options={{
          id: 'vela-chessboard',
          position,
          pieces: readablePieces,
          boardOrientation: boardOrientation || (playerColor === 'black' ? 'black' : 'white'),
          allowDragging: false,
          showNotation: true,
          darkSquareStyle: {
            backgroundColor: themeMode === 'dark' ? '#64748b' : '#8ab391',
          },
          lightSquareStyle: {
            backgroundColor: themeMode === 'dark' ? '#e5e7eb' : '#f0d9b5',
          },
          squareStyles: {
            ...moveSquareStyles,
            ...thinkingSquareStyles,
            ...selectedSquareStyles,
          },
          boardStyle: {
            border: '1px solid rgba(148, 163, 184, 0.55)',
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)',
          },
          onSquareClick: ({ square }) => handleSquareClick(square),
        }}
      />
    </Box>
  )
}

export default ChessBoard
