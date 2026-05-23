import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add,
  Casino,
  Login,
  Refresh,
  SportsEsports,
} from '@mui/icons-material'
import { requestJson } from './requestJson'

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
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

function getAuthHeaders(authToken) {
  return { Authorization: `Bearer ${authToken}` }
}

function parseFenBoard(fen) {
  const boardPart = fen?.split(' ')[0] || ''
  const ranks = boardPart.split('/')

  return ranks.flatMap((rank, rankIndex) => {
    const squares = []

    for (const char of rank) {
      if (/\d/.test(char)) {
        const count = Number(char)

        for (let index = 0; index < count; index += 1) {
          squares.push(null)
        }
      } else {
        squares.push(char)
      }
    }

    return squares.map((piece, fileIndex) => ({
      piece,
      square: `${files[fileIndex]}${8 - rankIndex}`,
      dark: (rankIndex + fileIndex) % 2 === 1,
    }))
  })
}

function getPlayerColor(game, userId) {
  if (Number(game?.white_user_id) === Number(userId)) {
    return 'white'
  }

  if (Number(game?.black_user_id) === Number(userId)) {
    return 'black'
  }

  return null
}

function gameTitle(game) {
  if (!game) {
    return 'No game'
  }

  return `Game ${game.id}`
}

function playerName(game, color) {
  return color === 'white'
    ? game?.white_username || 'Open'
    : game?.black_username || 'Open'
}

function statusLabel(game) {
  if (!game) {
    return 'Idle'
  }

  if (game.status === 'active') {
    return `${game.turn_color} to move`
  }

  if (game.status === 'waiting') {
    return 'Waiting'
  }

  if (game.status === 'checkmate') {
    return `Checkmate: ${game.winner_username || 'winner'}`
  }

  if (game.status === 'resigned') {
    return `${game.winner_username || 'Winner'} won`
  }

  return game.status
}

function addMoveOnce(current, move) {
  const exists = current.some((item) => (
    Number(item.move_number) === Number(move.move_number) &&
    item.san === move.san
  ))

  return exists ? current : [...current, move]
}

function ChessPage({ authToken, authUser, socket, socketConnected, themeMode, onError, onNotice }) {
  const [games, setGames] = useState([])
  const [openGames, setOpenGames] = useState([])
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [moves, setMoves] = useState([])
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [newGameColor, setNewGameColor] = useState('white')
  const [joinColor, setJoinColor] = useState('black')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [moveError, setMoveError] = useState(null)

  const authHeaders = useMemo(() => getAuthHeaders(authToken), [authToken])
  const playerColor = getPlayerColor(selectedGame, authUser.id)
  const canMove = Boolean(selectedGame?.status === 'active' && playerColor === selectedGame.turn_color)
  const boardSquares = useMemo(() => parseFenBoard(selectedGame?.fen), [selectedGame?.fen])

  const loadGames = useCallback(async () => {
    setLoading(true)

    try {
      const [mine, open] = await Promise.all([
        requestJson('/api/chess/games', { headers: authHeaders }),
        requestJson('/api/chess/games?scope=open', { headers: authHeaders }),
      ])

      setGames(mine.games || [])
      setOpenGames(open.games || [])

      if (!selectedGameId && mine.games?.[0]) {
        setSelectedGameId(mine.games[0].id)
      }
    } catch (err) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authHeaders, onError, selectedGameId])

  const loadGame = useCallback(async (gameId) => {
    if (!gameId) {
      setSelectedGame(null)
      setMoves([])
      return
    }

    try {
      const data = await requestJson(`/api/chess/games/${gameId}`, {
        headers: authHeaders,
      })

      setSelectedGame(data.game)
      setMoves(data.moves || [])
      setSelectedSquare(null)
    } catch (err) {
      onError(err.message)
    }
  }, [authHeaders, onError])

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(() => {
      if (!cancelled) {
        loadGames()
      }
    })

    return () => {
      cancelled = true
    }
  }, [loadGames])

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(() => {
      if (!cancelled) {
        loadGame(selectedGameId)
      }
    })

    return () => {
      cancelled = true
    }
  }, [loadGame, selectedGameId])

  useEffect(() => {
    if (!socket || !selectedGameId) {
      return undefined
    }

    socket.emit('chess:joinGame', selectedGameId, (response) => {
      if (response?.error) {
        onError(response.error)
        return
      }

      setSelectedGame(response.game)
      setMoves(response.moves || [])
    })

    return () => {
      socket.emit('chess:leaveGame', selectedGameId)
    }
  }, [onError, selectedGameId, socket])

  useEffect(() => {
    if (!socket) {
      return undefined
    }

    const handleGameUpdated = (game) => {
      setGames((current) => {
        const exists = current.some((item) => item.id === game.id)
        const next = exists ? current.map((item) => item.id === game.id ? game : item) : [game, ...current]
        return next
      })
      setOpenGames((current) => current.filter((item) => item.id !== game.id))

      if (Number(game.id) === Number(selectedGameId)) {
        setSelectedGame(game)
      }
    }

    const handleMoveMade = (result) => {
      if (Number(result.game?.id) !== Number(selectedGameId)) {
        return
      }

      setSelectedGame(result.game)
      setMoves((current) => addMoveOnce(current, result.move))
      setSelectedSquare(null)
      setMoveError(null)
    }

    socket.on('chess:gameUpdated', handleGameUpdated)
    socket.on('chess:moveMade', handleMoveMade)

    return () => {
      socket.off('chess:gameUpdated', handleGameUpdated)
      socket.off('chess:moveMade', handleMoveMade)
    }
  }, [selectedGameId, socket])

  async function createGame() {
    setBusy(true)

    try {
      const data = await requestJson('/api/chess/games', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ color: newGameColor }),
      })

      setSelectedGameId(data.game.id)
      setGames((current) => [data.game, ...current])
      onNotice('Chess game created')
      loadGames()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function joinGame(gameId) {
    setBusy(true)

    try {
      const data = await requestJson(`/api/chess/games/${gameId}/join`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ color: joinColor }),
      })

      setSelectedGameId(data.game.id)
      onNotice('Joined chess game')
      loadGames()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function movePiece(from, to) {
    if (!socket || !socketConnected) {
      setMoveError('Socket offline')
      return
    }

    socket.timeout(5000).emit(
      'chess:move',
      {
        gameId: selectedGame.id,
        from,
        to,
        promotion: 'q',
      },
      (err, response) => {
        if (err) {
          setMoveError('Move timed out')
          return
        }

        if (response?.error) {
          setMoveError(response.error)
          return
        }

        setSelectedGame(response.game)
        setMoves((current) => addMoveOnce(current, response.move))
        setSelectedSquare(null)
        setMoveError(null)
      },
    )
  }

  function handleSquareClick(square) {
    if (!selectedGame || !canMove) {
      return
    }

    if (!selectedSquare) {
      setSelectedSquare(square)
      setMoveError(null)
      return
    }

    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    movePiece(selectedSquare, square)
  }

  async function resignGame() {
    if (!selectedGame) {
      return
    }

    setBusy(true)

    try {
      const data = await requestJson(`/api/chess/games/${selectedGame.id}/resign`, {
        method: 'POST',
        headers: authHeaders,
      })

      setSelectedGame(data.game)
      onNotice('Game resigned')
      loadGames()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
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
      <Card sx={{ width: { xs: '100%', lg: 360 }, maxWidth: '100%', justifySelf: 'start' }}>
        <CardContent>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 900 }}>
              Chess
            </Typography>
            <Tooltip title="Refresh games">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadGames}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </span>
            </Tooltip>
          </Stack>

          <Stack spacing={1.5}>
            <ToggleButtonGroup
              value={newGameColor}
              exclusive
              size="small"
              onChange={(event, value) => value && setNewGameColor(value)}
              fullWidth
            >
              <ToggleButton value="white">White</ToggleButton>
              <ToggleButton value="black">Black</ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={createGame}
              disabled={busy}
              fullWidth
            >
              New game
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="overline" color="text.secondary">
            My games
          </Typography>
          {loading ? (
            <Stack sx={{ alignItems: 'center', py: 4 }}>
              <CircularProgress size={26} />
            </Stack>
          ) : games.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">No games</Typography>
            </Paper>
          ) : (
            <List disablePadding>
              {games.map((game) => (
                <ListItemButton
                  key={game.id}
                  selected={Number(game.id) === Number(selectedGameId)}
                  onClick={() => setSelectedGameId(game.id)}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemText
                    primary={gameTitle(game)}
                    secondary={`${playerName(game, 'white')} vs ${playerName(game, 'black')}`}
                  />
                  <Chip size="small" label={game.status} variant="outlined" />
                </ListItemButton>
              ))}
            </List>
          )}

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
              Open games
            </Typography>
            <TextField
              select
              size="small"
              value={joinColor}
              onChange={(event) => setJoinColor(event.target.value)}
              sx={{ width: 116 }}
            >
              <MenuItem value="white">White</MenuItem>
              <MenuItem value="black">Black</MenuItem>
            </TextField>
          </Stack>
          {openGames.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">No open games</Typography>
            </Paper>
          ) : (
            <List disablePadding>
              {openGames.map((game) => (
                <ListItemButton
                  key={game.id}
                  onClick={() => joinGame(game.id)}
                  disabled={busy}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemText
                    primary={gameTitle(game)}
                    secondary={`${playerName(game, 'white')} vs ${playerName(game, 'black')}`}
                  />
                  <Login fontSize="small" />
                </ListItemButton>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card sx={{ minHeight: { xs: 520, md: 'calc(100vh - 190px)' } }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', mb: 2 }}
          >
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                <SportsEsports color="primary" />
                <Typography variant="h5" component="h2" sx={{ fontWeight: 900 }}>
                  {selectedGame ? gameTitle(selectedGame) : 'Board'}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {selectedGame ? `${playerName(selectedGame, 'white')} vs ${playerName(selectedGame, 'black')}` : 'Pick a game'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip label={statusLabel(selectedGame)} color={selectedGame?.status === 'active' ? 'success' : 'default'} variant="outlined" />
              <Chip label={socketConnected ? 'Live' : 'Offline'} color={socketConnected ? 'success' : 'default'} variant="outlined" />
              {selectedGame?.status === 'active' && playerColor && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={resignGame}
                  disabled={busy}
                >
                  Resign
                </Button>
              )}
            </Stack>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {!selectedGame ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Casino sx={{ fontSize: 42, color: 'text.secondary', mb: 1 }} />
              <Typography color="text.secondary">Select or create game</Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: 'minmax(320px, 640px) minmax(240px, 1fr)' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Box>
                {moveError && (
                  <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setMoveError(null)}>
                    {moveError}
                  </Alert>
                )}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                    width: '100%',
                    maxWidth: 520,
                    aspectRatio: '1 / 1',
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                  }}
                >
                  {boardSquares.map((square) => (
                    <Box
                      component="button"
                      key={square.square}
                      type="button"
                      onClick={() => handleSquareClick(square.square)}
                      disabled={!canMove}
                      sx={{
                        position: 'relative',
                        border: 0,
                        p: 0,
                        cursor: canMove ? 'pointer' : 'default',
                        bgcolor: selectedSquare === square.square
                          ? 'warning.light'
                          : square.dark
                            ? themeMode === 'dark' ? '#64748b' : '#8ab391'
                            : themeMode === 'dark' ? '#e5e7eb' : '#f0d9b5',
                        color: /[A-Z]/.test(square.piece || '') ? '#f8fafc' : '#111827',
                        fontSize: { xs: 28, sm: 42, md: 52 },
                        lineHeight: 1,
                        fontFamily: 'serif',
                        '&:hover': {
                          filter: canMove ? 'brightness(1.08)' : 'none',
                        },
                      }}
                    >
                      {square.piece && pieceGlyphs[square.piece]}
                      <Typography
                        component="span"
                        sx={{
                          position: 'absolute',
                          left: 4,
                          bottom: 2,
                          fontSize: 10,
                          fontWeight: 800,
                          color: 'rgba(0, 0, 0, 0.56)',
                        }}
                      >
                        {square.square}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {selectedGame.status === 'active' && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {canMove ? 'Your turn' : 'Waiting for opponent'}
                  </Typography>
                )}
              </Box>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
                  Moves
                </Typography>
                {moves.length === 0 ? (
                  <Typography color="text.secondary">No moves yet</Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {moves.map((move) => (
                      <Stack
                        key={`${move.move_number}-${move.san}`}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {move.move_number}. {move.color}
                        </Typography>
                        <Typography sx={{ fontWeight: 800 }}>{move.san}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default ChessPage
