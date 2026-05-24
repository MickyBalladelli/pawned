import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { ChevronLeft, ChevronRight, MenuBook, Search } from '@mui/icons-material'
import { Chess } from 'chess.js'
import ChessBoard from './ChessBoard'
import openingsBook from './data/chessOpenings.json'

const startingFen = new Chess().fen()

function buildPositions(opening) {
  if (!opening) {
    return [startingFen]
  }

  const chess = new Chess()
  const positions = [chess.fen()]

  for (const san of opening.moves) {
    let move = null

    try {
      move = chess.move(san)
    } catch {
      move = null
    }

    if (!move) {
      break
    }

    positions.push(chess.fen())
  }

  return positions
}

function moveLabel(opening, index) {
  if (!opening || index === 0) {
    return 'Start'
  }

  return `${index}. ${opening.moves[index - 1]}`
}

function TrainingPage({ themeMode }) {
  const [trainingTab, setTrainingTab] = useState('openings')
  const [filter, setFilter] = useState('')
  const [selectedOpening, setSelectedOpening] = useState(openingsBook.openings[0])
  const [moveIndex, setMoveIndex] = useState(0)

  const visibleOpenings = useMemo(() => {
    const query = filter.trim().toLowerCase()

    if (!query) {
      return openingsBook.openings
    }

    return openingsBook.openings.filter((opening) => (
      opening.name.toLowerCase().includes(query) ||
      opening.eco.toLowerCase().includes(query) ||
      opening.moves.join(' ').toLowerCase().includes(query)
    ))
  }, [filter])

  const positions = useMemo(() => buildPositions(selectedOpening), [selectedOpening])
  const currentFen = positions[Math.min(moveIndex, positions.length - 1)] || startingFen
  const currentMove = moveLabel(selectedOpening, moveIndex)

  function selectOpening(opening) {
    setSelectedOpening(opening)
    setMoveIndex(0)
  }

  function previousMove() {
    setMoveIndex((current) => Math.max(0, current - 1))
  }

  function nextMove() {
    setMoveIndex((current) => Math.min(positions.length - 1, current + 1))
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '360px minmax(0, 1fr)' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Card
        sx={{
          width: { xs: '100%', lg: 360 },
          maxWidth: '100%',
          maxHeight: { lg: 'calc(100vh - 190px)' },
          overflow: 'hidden',
        }}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: { lg: 'calc(100vh - 190px)' },
            minHeight: 0,
          }}
        >
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Typography
              variant="h5"
              component="h2"
              sx={{
                color: themeMode === 'dark' ? 'text.primary' : '#05070a',
                fontWeight: 900,
              }}
            >
              Training
            </Typography>
            <Tabs
              value={trainingTab}
              onChange={(event, value) => setTrainingTab(value)}
              variant="fullWidth"
              sx={{ minHeight: 32 }}
            >
              <Tab label="Openings" value="openings" sx={{ minHeight: 32 }} />
            </Tabs>
            <TextField
              label="Filter openings"
              size="small"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              InputProps={{
                startAdornment: <Search fontSize="small" sx={{ mr: 0.75, color: 'text.secondary' }} />,
              }}
              fullWidth
            />
          </Stack>

          <Divider sx={{ mb: 1 }} />

          <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
            {trainingTab === 'openings' && (
              <List disablePadding>
                {visibleOpenings.map((opening) => (
                  <ListItemButton
                    key={`${opening.eco}-${opening.name}-${opening.moves.join('-')}`}
                    selected={selectedOpening === opening}
                    onClick={() => selectOpening(opening)}
                    sx={{ borderRadius: 1, mb: 0.5 }}
                  >
                    <ListItemText
                      primary={opening.name}
                      secondary={`${opening.eco} · ${opening.moves.join(' ')}`}
                      slotProps={{
                        primary: { noWrap: true },
                        secondary: { noWrap: true },
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ minHeight: { xs: 520, md: 'calc(100vh - 190px)' } }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', mb: 2 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                <MenuBook color="primary" />
                <Typography
                  variant="h5"
                  component="h2"
                  noWrap
                  sx={{
                    color: themeMode === 'dark' ? 'text.primary' : '#05070a',
                    fontWeight: 900,
                  }}
                >
                  {selectedOpening?.name || 'Opening'}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" noWrap>
                {selectedOpening?.moves.join(' ') || 'Pick an opening'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {selectedOpening && <Chip label={selectedOpening.eco} variant="outlined" />}
              <Chip label={`${moveIndex}/${Math.max(0, positions.length - 1)}`} variant="outlined" />
            </Stack>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 560px) minmax(260px, 1fr)' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box>
              <ChessBoard
                position={currentFen}
                playerColor="white"
                selectedSquare={null}
                themeMode={themeMode}
                onSquareClick={() => {}}
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ChevronLeft />}
                  onClick={previousMove}
                  disabled={moveIndex === 0}
                  sx={{ minWidth: 112 }}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ChevronRight />}
                  onClick={nextMove}
                  disabled={moveIndex >= positions.length - 1}
                  sx={{ minWidth: 112 }}
                >
                  Next
                </Button>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {currentMove}
              </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, maxHeight: { lg: 520 }, overflow: 'auto' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
                Moves
              </Typography>
              <Stack spacing={0.5}>
                <Button
                  size="small"
                  variant={moveIndex === 0 ? 'contained' : 'text'}
                  onClick={() => setMoveIndex(0)}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Start
                </Button>
                {selectedOpening?.moves.map((move, index) => (
                  <Button
                    key={`${move}-${index}`}
                    size="small"
                    variant={moveIndex === index + 1 ? 'contained' : 'text'}
                    onClick={() => setMoveIndex(index + 1)}
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <span>{index + 1}. {move}</span>
                  </Button>
                ))}
              </Stack>
            </Paper>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default TrainingPage
