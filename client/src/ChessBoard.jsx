import { Box, Typography } from '@mui/material'

const pieceGlyphs = {
  p: '♟',
  r: '♜',
  n: '♞',
  b: '♝',
  q: '♛',
  k: '♚',
  P: '♙',
  R: '♖',
  N: '♘',
  B: '♗',
  Q: '♕',
  K: '♔',
}

function pieceColor(piece) {
  return /[A-Z]/.test(piece || '') ? 'light' : 'dark'
}

function ChessBoard({
  boardSquares,
  boardStyle,
  canMove,
  selectedSquare,
  themeMode,
  onSquareClick,
}) {
  const is3d = boardStyle === 'wood3d'

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: is3d ? 620 : 520,
        mx: { xs: 'auto', xl: 0 },
        perspective: is3d ? '1200px' : 'none',
        pt: is3d ? { xs: 3, sm: 5 } : 0,
        pb: is3d ? { xs: 2, sm: 4 } : 0,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          boxSizing: 'border-box',
          transform: is3d ? 'rotateX(52deg) rotateZ(-3deg)' : 'none',
          transformOrigin: '50% 68%',
          transformStyle: 'preserve-3d',
          border: is3d ? '18px solid #7a421d' : 1,
          borderColor: is3d ? '#7a421d' : 'divider',
          borderRadius: is3d ? 1 : 0,
          boxShadow: is3d
            ? '0 34px 38px rgba(25, 13, 5, 0.42), inset 0 0 0 4px rgba(255, 226, 170, 0.32), inset 0 0 22px rgba(50, 21, 5, 0.38)'
            : 'none',
          bgcolor: is3d ? '#6d3919' : 'background.default',
          backgroundImage: is3d
            ? 'linear-gradient(90deg, rgba(255,255,255,0.08), transparent 18%, rgba(0,0,0,0.12) 48%, transparent 76%), repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 9px)'
            : 'none',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
            position: 'absolute',
            inset: is3d ? 18 : 0,
            border: is3d ? '2px solid rgba(255, 229, 179, 0.62)' : 0,
            transformStyle: 'preserve-3d',
          }}
        >
          {boardSquares.map((square) => {
            const color = pieceColor(square.piece)

            return (
              <Box
                component="button"
                key={square.square}
                type="button"
                onClick={() => onSquareClick(square.square)}
                disabled={!canMove}
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  minWidth: 0,
                  minHeight: 0,
                  border: 0,
                  p: 0,
                  cursor: canMove ? 'pointer' : 'default',
                  overflow: 'visible',
                  transformStyle: 'preserve-3d',
                  bgcolor: selectedSquare === square.square
                    ? 'warning.light'
                    : square.dark
                      ? is3d ? '#9b5726' : themeMode === 'dark' ? '#64748b' : '#8ab391'
                      : is3d ? '#f2d793' : themeMode === 'dark' ? '#e5e7eb' : '#f0d9b5',
                  backgroundImage: is3d
                    ? square.dark
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.12), transparent 38%, rgba(60,24,6,0.22)), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.28), transparent 42%, rgba(128,77,20,0.16)), repeating-linear-gradient(90deg, rgba(156,103,31,0.08) 0 1px, transparent 1px 8px)'
                    : 'none',
                  color: color === 'light'
                    ? is3d ? '#d9a752' : '#f8fafc'
                    : is3d ? '#3f210e' : '#111827',
                  fontSize: is3d ? { xs: 24, sm: 34, md: 42 } : { xs: 28, sm: 42, md: 52 },
                  lineHeight: 1,
                  fontFamily: 'Georgia, serif',
                  textShadow: is3d
                    ? color === 'light'
                      ? '0 1px 0 #ffe5a3, 0 7px 8px rgba(50, 24, 8, 0.58)'
                      : '0 1px 0 #8a562a, 0 7px 8px rgba(24, 10, 4, 0.7)'
                    : 'none',
                  '&:hover': {
                    filter: canMove ? 'brightness(1.08)' : 'none',
                  },
                }}
              >
                {square.piece && (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      transform: is3d
                        ? 'translateY(-18%) translateZ(34px) rotateX(-48deg)'
                        : 'none',
                    }}
                  >
                    {pieceGlyphs[square.piece]}
                  </Box>
                )}
                <Typography
                  component="span"
                  sx={{
                    position: 'absolute',
                    left: is3d ? 3 : 4,
                    bottom: is3d ? 1 : 2,
                    fontSize: is3d ? 8 : 10,
                    fontWeight: 800,
                    color: is3d ? 'rgba(58, 31, 10, 0.62)' : 'rgba(0, 0, 0, 0.56)',
                    pointerEvents: 'none',
                  }}
                >
                  {square.square}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

export default ChessBoard
