import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import ChessBoard from './ChessBoard'

function moveLabel(move) {
  return `${move.moveNumber}${move.color === 'white' ? '.' : '...'} ${move.san}`
}

function RLTrainingGameViewer({
  games = [],
  fallbackGame = null,
  elapsedMs = 0,
  selectedGameId,
  onSelectedGameIdChange,
  themeMode,
}) {
  const visibleGames = games.length > 0 ? games : fallbackGame ? [fallbackGame] : []
  const [localSelectedGameId, setLocalSelectedGameId] = useState(null)
  const activeGameId = selectedGameId ?? localSelectedGameId
  const game = fallbackGame?.id === activeGameId || !activeGameId
    ? fallbackGame
    : fallbackGame || null
  const [selectedPly, setSelectedPly] = useState(null)
  const moves = game?.moves || []
  const selectedMove = selectedPly ? moves[selectedPly - 1] : null
  const boardFen = selectedMove?.fen || game?.currentFen || game?.initialFen
  const selectedLabel = selectedMove ? moveLabel(selectedMove) : 'Latest'
  const movePairs = useMemo(() => {
    const pairs = []

    for (const move of moves) {
      const pairIndex = move.moveNumber - 1

      if (!pairs[pairIndex]) {
        pairs[pairIndex] = {
          moveNumber: move.moveNumber,
          white: null,
          black: null,
        }
      }

      pairs[pairIndex][move.color] = move
    }

    return pairs
  }, [moves])

  useEffect(() => {
    setSelectedPly(null)
  }, [game?.currentFen])

  useEffect(() => {
    if (!visibleGames.length) {
      setLocalSelectedGameId(null)
      onSelectedGameIdChange?.(null)
      return
    }

    if (!visibleGames.some((item) => item.id === activeGameId)) {
      setLocalSelectedGameId(visibleGames[0].id)
      onSelectedGameIdChange?.(visibleGames[0].id)
    }
  }, [activeGameId, onSelectedGameIdChange, visibleGames])

  function previousMove() {
    setSelectedPly((current) => {
      const ply = current || moves.length
      return Math.max(1, ply - 1)
    })
  }

  function nextMove() {
    setSelectedPly((current) => {
      if (!current || current >= moves.length) {
        return null
      }

      return current + 1
    })
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}
        >
          <Box>
            <Typography
              variant="h6"
              sx={{
                color: themeMode === 'dark' ? 'text.primary' : '#05070a',
                fontWeight: 900,
              }}
            >
              Self-play board
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {game ? selectedLabel : 'No game'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip label={`${visibleGames.length} games`} variant="outlined" />
            <Chip label={`${Math.floor(elapsedMs / 1000)}s`} variant="outlined" />
            <Chip label={`${moves.length} plies`} variant="outlined" />
            <Chip label={game?.result || 'idle'} variant="outlined" />
          </Stack>
        </Stack>

        <Divider />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 520px) minmax(240px, 1fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Box>
            {game ? (
              <ChessBoard
                position={boardFen}
                playerColor="white"
                selectedSquare={null}
                themeMode={themeMode}
                onSquareClick={() => {}}
              />
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  aspectRatio: '1 / 1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 2,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Start training to see board
                </Typography>
              </Paper>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ChevronLeft />}
                onClick={previousMove}
                disabled={moves.length <= 1}
                sx={{ minWidth: 104 }}
              >
                Previous
              </Button>
              <Button
                size="small"
                variant="outlined"
                endIcon={<ChevronRight />}
                onClick={nextMove}
                disabled={!selectedPly || selectedPly >= moves.length}
                sx={{ minWidth: 104 }}
              >
                Next
              </Button>
            </Stack>
          </Box>

          <List
            dense
            disablePadding
            sx={{
              maxHeight: { lg: 520 },
              overflowY: 'auto',
            }}
          >
            {movePairs.map((pair) => (
              <Stack
                key={pair.moveNumber}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'stretch', mb: 0.5 }}
              >
                <Chip
                  label={pair.moveNumber}
                  size="small"
                  variant="outlined"
                  sx={{ width: 44, mt: 0.5 }}
                />
                <ListItemButton
                  selected={selectedPly === pair.white?.ply}
                  onClick={() => pair.white && setSelectedPly(pair.white.ply)}
                  disabled={!pair.white}
                  sx={{ borderRadius: 1, minHeight: 42 }}
                >
                  <ListItemText
                    primary={pair.white?.san || '-'}
                    secondary={pair.white?.uci || ''}
                    slotProps={{
                      primary: { noWrap: true },
                      secondary: { noWrap: true },
                    }}
                  />
                </ListItemButton>
                <ListItemButton
                  selected={selectedPly === pair.black?.ply}
                  onClick={() => pair.black && setSelectedPly(pair.black.ply)}
                  disabled={!pair.black}
                  sx={{ borderRadius: 1, minHeight: 42 }}
                >
                  <ListItemText
                    primary={pair.black?.san || '-'}
                    secondary={pair.black?.uci || ''}
                    slotProps={{
                      primary: { noWrap: true },
                      secondary: { noWrap: true },
                    }}
                  />
                </ListItemButton>
              </Stack>
            ))}
          </List>
        </Box>
      </Stack>
    </Paper>
  )
}

export default RLTrainingGameViewer
