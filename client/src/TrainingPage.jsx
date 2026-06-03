import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { ChevronLeft, ChevronRight, MenuBook, Search } from '@mui/icons-material'
import { Chess } from 'chess.js'
import ChessBoard from './ChessBoard'
import openingsBook from './data/chessOpenings.json'

const startingFen = new Chess().fen()
const puzzlePreviewLimit = 200
const trainingTabStorageKey = 'pawned.training.tab'
const puzzleDifficulties = [
  { value: 'easy', label: 'Easy', range: '800-1200' },
  { value: 'medium', label: 'Medium', range: '1201-1600' },
  { value: 'hard', label: 'Hard', range: '1601-2000' },
  { value: 'expert', label: 'Expert', range: '2001-2600' },
]

function solvedPuzzleStorageKey(userId) {
  return `pawned.training.solvedPuzzles.${userId || 'guest'}`
}

function readSolvedPuzzles(userId) {
  try {
    const value = localStorage.getItem(solvedPuzzleStorageKey(userId))
    const ids = JSON.parse(value || '[]')
    return new Set(Array.isArray(ids) ? ids : [])
  } catch {
    return new Set()
  }
}

function writeSolvedPuzzles(userId, ids) {
  localStorage.setItem(solvedPuzzleStorageKey(userId), JSON.stringify([...ids]))
}

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

function applyUci(chess, uci) {
  if (!uci || uci.length < 4) {
    return null
  }

  try {
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    })
  } catch {
    return null
  }
}

function puzzleStart(puzzle) {
  if (!puzzle) {
    return null
  }

  const chess = new Chess(puzzle.fen)
  const firstMove = applyUci(chess, puzzle.moves[0])

  if (!firstMove) {
    return null
  }

  return chess
}

function puzzleSolverColor(puzzle) {
  const chess = puzzleStart(puzzle)
  return turnColor(chess)
}

function puzzlePositions(puzzle) {
  if (!puzzle) {
    return [startingFen]
  }

  const chess = new Chess(puzzle.fen)
  const positions = [chess.fen()]

  for (const uci of puzzle.moves) {
    const move = applyUci(chess, uci)

    if (!move) {
      break
    }

    positions.push(chess.fen())
  }

  return positions
}

function puzzleMoveLabel(uci, index) {
  if (!uci) {
    return 'Start'
  }

  return `${index + 1}. ${uci.slice(0, 2)}-${uci.slice(2, 4)}`
}

function turnColor(chess) {
  return chess?.turn() === 'b' ? 'black' : 'white'
}

function cleanTheme(theme) {
  return String(theme || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

function TrainingPage({ authUser, themeMode }) {
  const [trainingTab, setTrainingTab] = useState(() => (
    ['openings', 'puzzles'].includes(localStorage.getItem(trainingTabStorageKey))
      ? localStorage.getItem(trainingTabStorageKey)
      : 'openings'
  ))
  const [filter, setFilter] = useState('')
  const [selectedOpening, setSelectedOpening] = useState(openingsBook.openings[0])
  const [moveIndex, setMoveIndex] = useState(0)
  const [puzzles, setPuzzles] = useState([])
  const [puzzleLoading, setPuzzleLoading] = useState(false)
  const [puzzleDifficulty, setPuzzleDifficulty] = useState('easy')
  const [selectedPuzzle, setSelectedPuzzle] = useState(null)
  const [puzzleFen, setPuzzleFen] = useState(startingFen)
  const [puzzleStep, setPuzzleStep] = useState(1)
  const [puzzleViewIndex, setPuzzleViewIndex] = useState(null)
  const [puzzleSelectedSquare, setPuzzleSelectedSquare] = useState(null)
  const [puzzleStatus, setPuzzleStatus] = useState('Pick a puzzle')
  const [puzzleSolved, setPuzzleSolved] = useState(false)
  const [solvedPuzzleIds, setSolvedPuzzleIds] = useState(() => readSolvedPuzzles(authUser?.id))

  useEffect(() => {
    setSolvedPuzzleIds(readSolvedPuzzles(authUser?.id))
  }, [authUser?.id])

  useEffect(() => {
    localStorage.setItem(trainingTabStorageKey, trainingTab)
  }, [trainingTab])

  useEffect(() => {
    let cancelled = false

    if (trainingTab !== 'puzzles') {
      return undefined
    }

    setPuzzleLoading(true)
    setPuzzles([])
    setSelectedPuzzle(null)
    setPuzzleFen(startingFen)
    setPuzzleStatus('Loading puzzles')
    fetch(`/data/chessPuzzles-${puzzleDifficulty}.json`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return
        }

        const loadedPuzzles = data.puzzles || []
        setPuzzles(loadedPuzzles)
        setSelectedPuzzle(loadedPuzzles[0] || null)
      })
      .catch(() => {
        if (!cancelled) {
          setPuzzleStatus('Could not load puzzles')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPuzzleLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [puzzleDifficulty, trainingTab])

  useEffect(() => {
    if (!selectedPuzzle) {
      return
    }

    const chess = puzzleStart(selectedPuzzle)

    if (!chess) {
      setPuzzleFen(startingFen)
      setPuzzleStatus('Puzzle cannot load')
      return
    }

    setPuzzleFen(chess.fen())
    setPuzzleStep(1)
    setPuzzleViewIndex(null)
    setPuzzleSelectedSquare(null)
    setPuzzleSolved(false)
    setPuzzleStatus(`${turnColor(chess)} to solve`)
  }, [selectedPuzzle])

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
  const visiblePuzzles = useMemo(() => {
    const query = filter.trim().toLowerCase()
    const matches = query
      ? puzzles.filter((puzzle) => (
        puzzle.id.toLowerCase().includes(query) ||
        String(puzzle.rating).includes(query) ||
        puzzle.themes.join(' ').toLowerCase().includes(query) ||
        puzzle.openingTags.join(' ').toLowerCase().includes(query)
      ))
      : puzzles

    return matches.slice(0, puzzlePreviewLimit)
  }, [filter, puzzles])
  const selectedPuzzlePositions = useMemo(() => puzzlePositions(selectedPuzzle), [selectedPuzzle])
  const viewedPuzzleFen = puzzleViewIndex === null
    ? puzzleFen
    : selectedPuzzlePositions[puzzleViewIndex] || puzzleFen
  const puzzleBoardOrientation = puzzleSolverColor(selectedPuzzle)
  const selectedPuzzleWasSolved = Boolean(selectedPuzzle && solvedPuzzleIds.has(selectedPuzzle.id))

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

  function selectPuzzle(puzzle) {
    setSelectedPuzzle(puzzle)
  }

  function markPuzzleSolved(puzzleId) {
    setSolvedPuzzleIds((current) => {
      if (current.has(puzzleId)) {
        return current
      }

      const next = new Set(current)
      next.add(puzzleId)
      writeSolvedPuzzles(authUser?.id, next)
      return next
    })
  }

  function nextPuzzle() {
    if (puzzles.length === 0 || !selectedPuzzle) {
      return
    }

    const index = puzzles.findIndex((puzzle) => puzzle.id === selectedPuzzle.id)
    const nextIndex = index >= 0 ? (index + 1) % puzzles.length : 0
    setSelectedPuzzle(puzzles[nextIndex])
  }

  function previousPuzzleMove() {
    setPuzzleViewIndex((current) => {
      if (current === null) {
        return selectedPuzzlePositions.length - 1
      }

      return Math.max(0, current - 1)
    })
    setPuzzleSelectedSquare(null)
  }

  function nextPuzzleMove() {
    setPuzzleViewIndex((current) => {
      if (current === null) {
        return null
      }

      if (current >= selectedPuzzlePositions.length - 1) {
        return null
      }

      return current + 1
    })
    setPuzzleSelectedSquare(null)
  }

  function handlePuzzleMove(from, to) {
    if (!selectedPuzzle || puzzleSolved) {
      return
    }

    if (puzzleViewIndex !== null) {
      setPuzzleViewIndex(null)
      return
    }

    const expected = selectedPuzzle.moves[puzzleStep]
    const played = `${from}${to}`.toLowerCase()

    if (!expected || played !== expected.slice(0, 4).toLowerCase()) {
      setPuzzleStatus('Try again')
      setPuzzleSelectedSquare(null)
      return
    }

    const chess = new Chess(puzzleFen)
    const userMove = applyUci(chess, expected)

    if (!userMove) {
      setPuzzleStatus('Puzzle move failed')
      return
    }

    let nextStep = puzzleStep + 1

    if (nextStep >= selectedPuzzle.moves.length) {
      setPuzzleFen(chess.fen())
      setPuzzleStep(nextStep)
      setPuzzleSolved(true)
      markPuzzleSolved(selectedPuzzle.id)
      setPuzzleSelectedSquare(null)
      setPuzzleStatus('Solved')
      return
    }

    applyUci(chess, selectedPuzzle.moves[nextStep])
    nextStep += 1

    setPuzzleFen(chess.fen())
    setPuzzleStep(nextStep)
    setPuzzleSelectedSquare(null)
    setPuzzleStatus(nextStep >= selectedPuzzle.moves.length ? 'Solved' : `${turnColor(chess)} to solve`)
    setPuzzleSolved(nextStep >= selectedPuzzle.moves.length)
    if (nextStep >= selectedPuzzle.moves.length) {
      markPuzzleSolved(selectedPuzzle.id)
    }
  }

  function handlePuzzleSquareClick(square) {
    if (!selectedPuzzle || puzzleSolved) {
      return
    }

    if (!puzzleSelectedSquare) {
      setPuzzleSelectedSquare(square)
      return
    }

    if (puzzleSelectedSquare === square) {
      setPuzzleSelectedSquare(null)
      return
    }

    handlePuzzleMove(puzzleSelectedSquare, square)
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
              <Tab label="Puzzles" value="puzzles" sx={{ minHeight: 32 }} />
            </Tabs>
            <TextField
              label={trainingTab === 'puzzles' ? 'Filter puzzles' : 'Filter openings'}
              size="small"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              InputProps={{
                startAdornment: <Search fontSize="small" sx={{ mr: 0.75, color: 'text.secondary' }} />,
              }}
              fullWidth
            />
            {trainingTab === 'puzzles' && (
              <ToggleButtonGroup
                value={puzzleDifficulty}
                exclusive
                size="small"
                onChange={(event, value) => value && setPuzzleDifficulty(value)}
                fullWidth
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 0.5,
                    fontSize: 11,
                    lineHeight: 1.2,
                  },
                }}
              >
                {puzzleDifficulties.map((difficulty) => (
                  <ToggleButton key={difficulty.value} value={difficulty.value}>
                    {difficulty.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
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
            {trainingTab === 'puzzles' && (
              puzzleLoading ? (
                <Stack sx={{ alignItems: 'center', py: 4 }}>
                  <CircularProgress size={26} />
                </Stack>
              ) : (
                <List disablePadding>
                  {visiblePuzzles.map((puzzle) => (
                    <ListItemButton
                      key={puzzle.id}
                      selected={selectedPuzzle?.id === puzzle.id}
                      onClick={() => selectPuzzle(puzzle)}
                      sx={{ borderRadius: 1, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={`Puzzle ${puzzle.id}`}
                        secondary={`${puzzle.rating} · ${puzzle.themes.map(cleanTheme).slice(0, 3).join(', ')}`}
                        slotProps={{
                          primary: { noWrap: true },
                          secondary: { noWrap: true },
                        }}
                      />
                      {solvedPuzzleIds.has(puzzle.id) && (
                        <Chip size="small" label="Solved" color="success" variant="outlined" />
                      )}
                    </ListItemButton>
                  ))}
                </List>
              )
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
                  {trainingTab === 'puzzles' ? `Puzzle ${selectedPuzzle?.id || ''}` : selectedOpening?.name || 'Opening'}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" noWrap>
                {trainingTab === 'puzzles'
                  ? selectedPuzzle?.themes.map(cleanTheme).join(', ') || 'Pick a puzzle'
                  : selectedOpening?.moves.join(' ') || 'Pick an opening'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {trainingTab === 'puzzles' ? (
                <>
                  {selectedPuzzle && <Chip label={selectedPuzzle.rating} variant="outlined" />}
                  <Chip
                    label={puzzleDifficulties.find((difficulty) => difficulty.value === puzzleDifficulty)?.range}
                    variant="outlined"
                  />
                  <Chip label={puzzleStatus} color={puzzleSolved ? 'success' : 'default'} variant="outlined" />
                </>
              ) : (
                <>
                  {selectedOpening && <Chip label={selectedOpening.eco} variant="outlined" />}
                  <Chip label={`${moveIndex}/${Math.max(0, positions.length - 1)}`} variant="outlined" />
                </>
              )}
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
              {trainingTab === 'puzzles' ? (
                <ChessBoard
                  position={viewedPuzzleFen}
                  playerColor={puzzleBoardOrientation}
                  selectedSquare={puzzleSelectedSquare}
                  themeMode={themeMode}
                  onSquareClick={handlePuzzleSquareClick}
                />
              ) : (
                <ChessBoard
                  position={currentFen}
                  playerColor="white"
                  selectedSquare={null}
                  themeMode={themeMode}
                  onSquareClick={() => {}}
                />
              )}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                {trainingTab === 'puzzles' ? (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ChevronLeft />}
                      onClick={previousPuzzleMove}
                      disabled={!selectedPuzzle || selectedPuzzlePositions.length <= 1}
                      sx={{ minWidth: 112 }}
                    >
                      Previous
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<ChevronRight />}
                      onClick={nextPuzzleMove}
                      disabled={!selectedPuzzle || selectedPuzzlePositions.length <= 1 || puzzleViewIndex === null}
                      sx={{ minWidth: 112 }}
                    >
                      Next
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={nextPuzzle}
                      disabled={puzzles.length === 0}
                      sx={{ minWidth: 112 }}
                    >
                      Next puzzle
                    </Button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {trainingTab === 'puzzles'
                  ? puzzleViewIndex === null ? puzzleStatus : puzzleMoveLabel(selectedPuzzle?.moves[puzzleViewIndex - 1], puzzleViewIndex - 1)
                  : currentMove}
              </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, maxHeight: { lg: 520 }, overflow: 'auto' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
                {trainingTab === 'puzzles' ? 'Puzzle' : 'Moves'}
              </Typography>
              {trainingTab === 'puzzles' ? (
                <Stack spacing={1}>
                  <Typography variant="body2">
                    Rating: {selectedPuzzle?.rating || '-'}
                  </Typography>
                  <Typography variant="body2">
                    Plays: {selectedPuzzle?.plays || '-'}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedPuzzle?.themes.map((theme) => (
                      <Chip key={theme} size="small" label={cleanTheme(theme)} variant="outlined" />
                    ))}
                  </Stack>
                  <Stack spacing={0.5}>
                    <Button
                      size="small"
                      variant={puzzleViewIndex === 0 ? 'contained' : 'text'}
                      onClick={() => setPuzzleViewIndex(0)}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      Start
                    </Button>
                    {selectedPuzzle?.moves.map((move, index) => (
                      <Button
                        key={`${move}-${index}`}
                        size="small"
                        variant={puzzleViewIndex === index + 1 ? 'contained' : 'text'}
                        onClick={() => setPuzzleViewIndex(index + 1)}
                        sx={{ justifyContent: 'space-between' }}
                      >
                        <span>{puzzleMoveLabel(move, index)}</span>
                      </Button>
                    ))}
                  </Stack>
                  {(puzzleSolved || selectedPuzzleWasSolved) && (
                    <Typography variant="body2" color="success.main" sx={{ fontWeight: 900 }}>
                      {puzzleSolved ? 'Solved' : 'Solved before'}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Solved: {solvedPuzzleIds.size}
                  </Typography>
                </Stack>
              ) : (
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
              )}
            </Paper>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default TrainingPage
