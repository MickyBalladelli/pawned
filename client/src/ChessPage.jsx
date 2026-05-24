import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Checkbox,
  FormControlLabel,
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
  Delete,
  ExpandLess,
  ExpandMore,
  Casino,
  ChevronLeft,
  ChevronRight,
  Refresh,
  SportsEsports,
} from '@mui/icons-material'
import ChessBoard from './ChessBoard'
import ChessGameChat from './ChessGameChat'
import { requestJson } from './requestJson'

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const botLevels = [600, 800, 1000, 1200, 1400, 1600]
const selectedGameStorageKey = 'vela.chess.selectedGameId'

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

function isOwnPiece(piece, playerColor) {
  if (!piece || !playerColor) {
    return false
  }

  return playerColor === 'white' ? /[A-Z]/.test(piece) : /[a-z]/.test(piece)
}

function gameTitle(game) {
  if (!game) {
    return 'No game'
  }

  return `#${game.id}`
}

function playerName(game, color) {
  if (game?.is_bot_game) {
    const username = color === 'white' ? game?.white_username : game?.black_username

    if (username === 'VelaBot') {
      return `Bot ${game.bot_level || ''}`.trim()
    }
  }

  return color === 'white'
    ? game?.white_username || 'Open'
    : game?.black_username || 'Open'
}

function matchupLabel(game) {
  return `${playerName(game, 'white')} vs ${playerName(game, 'black')}`
}

function openColorForGame(game) {
  return game?.white_user_id ? 'black' : 'white'
}

function isCompletedGame(game) {
  return ['checkmate', 'draw', 'resigned', 'canceled'].includes(game?.status)
}

function isActiveGame(game) {
  return game?.status === 'active' || game?.status === 'waiting'
}

function statusLabel(game, user = null) {
  if (!game) {
    return 'Idle'
  }

  if (game.status === 'active') {
    return `${game.turn_color} to move`
  }

  if (game.status === 'waiting') {
    return 'Waiting'
  }

  if (game.status === 'canceled') {
    return 'Canceled'
  }

  if (game.status === 'checkmate') {
    const playerColor = user ? getPlayerColor(game, user.id) : null

    if (!playerColor || !game.winner_user_id) {
      return 'Mate'
    }

    return Number(game.winner_user_id) === Number(user.id) ? 'Won' : 'Lost'
  }

  if (game.status === 'resigned') {
    const playerColor = user ? getPlayerColor(game, user.id) : null

    if (!playerColor || !game.winner_user_id) {
      return 'Won'
    }

    return Number(game.winner_user_id) === Number(user.id) ? 'Won' : 'Lost'
  }

  return game.status
}

function statusColor(game, user = null) {
  if (!game) {
    return 'default'
  }

  if (game.status === 'active') {
    return 'success'
  }

  if (game.status === 'waiting') {
    return 'info'
  }

  if (game.status === 'checkmate' || game.status === 'resigned') {
    const playerColor = user ? getPlayerColor(game, user.id) : null

    if (playerColor && Number(game.winner_user_id) !== Number(user.id)) {
      return 'error'
    }

    return 'success'
  }

  if (game.status === 'draw') {
    return 'warning'
  }

  if (game.status === 'canceled') {
    return 'default'
  }

  return 'default'
}

function addMoveOnce(current, move) {
  const exists = current.some((item) => (
    Number(item.move_number) === Number(move.move_number) &&
    item.san === move.san
  ))

  return exists ? current : [...current, move]
}

function getInitialSelectedGameId() {
  const params = new URLSearchParams(window.location.search)
  const queryGameId = Number(params.get('chessGame'))

  if (Number.isFinite(queryGameId) && queryGameId > 0) {
    return queryGameId
  }

  const value = localStorage.getItem(selectedGameStorageKey)
  const numericValue = Number(value)

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null
}

function setStoredSelectedGameId(gameId) {
  if (gameId) {
    localStorage.setItem(selectedGameStorageKey, String(gameId))
  } else {
    localStorage.removeItem(selectedGameStorageKey)
  }
}

function setUrlSelectedGameId(gameId) {
  const url = new URL(window.location.href)

  if (gameId) {
    url.searchParams.set('chessGame', String(gameId))
  } else {
    url.searchParams.delete('chessGame')
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function ChessPage({ authToken, authUser, socket, socketConnected, themeMode, onError, onNotice }) {
  const [games, setGames] = useState([])
  const [openGames, setOpenGames] = useState([])
  const [activeGames, setActiveGames] = useState([])
  const [completedGames, setCompletedGames] = useState([])
  const [selectedGameId, setSelectedGameId] = useState(getInitialSelectedGameId)
  const [selectedGame, setSelectedGame] = useState(null)
  const [moves, setMoves] = useState([])
  const [viewMoveIndex, setViewMoveIndex] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [newGameColor, setNewGameColor] = useState('white')
  const [botLevel, setBotLevel] = useState(800)
  const [expandedGameIds, setExpandedGameIds] = useState(new Set())
  const [showMyCompletedOnly, setShowMyCompletedOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [moveError, setMoveError] = useState(null)
  const movesEndRef = useRef(null)

  const authHeaders = useMemo(() => getAuthHeaders(authToken), [authToken])
  const playerColor = getPlayerColor(selectedGame, authUser.id)
  const canMove = Boolean(selectedGame?.status === 'active' && playerColor === selectedGame.turn_color)
  const viewedFen = viewMoveIndex === null
    ? selectedGame?.fen
    : moves[viewMoveIndex]?.fen_after
  const boardSquares = useMemo(() => parseFenBoard(viewedFen), [viewedFen])
  const isViewingHistory = viewMoveIndex !== null
  const myActiveGames = useMemo(() => games.filter(isActiveGame), [games])
  const myCompletedGames = useMemo(() => games.filter(isCompletedGame), [games])
  const watchGames = useMemo(() => (
    activeGames.filter((game) => !getPlayerColor(game, authUser.id))
  ), [activeGames, authUser.id])
  const visibleCompletedGames = useMemo(() => {
    if (showMyCompletedOnly) {
      return myCompletedGames
    }

    const ownIds = new Set(myCompletedGames.map((game) => game.id))
    return [
      ...myCompletedGames,
      ...completedGames.filter((game) => !ownIds.has(game.id)),
    ]
  }, [completedGames, myCompletedGames, showMyCompletedOnly])

  const loadGames = useCallback(async () => {
    setLoading(true)

    try {
      const [mine, open, active, completed] = await Promise.all([
        requestJson('/api/chess/games', { headers: authHeaders }),
        requestJson('/api/chess/games?scope=open', { headers: authHeaders }),
        requestJson('/api/chess/games?scope=active', { headers: authHeaders }),
        requestJson('/api/chess/games?scope=completed', { headers: authHeaders }),
      ])

      setGames(mine.games || [])
      setOpenGames(open.games || [])
      setActiveGames(active.games || [])
      setCompletedGames(completed.games || [])

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
      setViewMoveIndex(null)
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
    setStoredSelectedGameId(selectedGameId)
    setUrlSelectedGameId(selectedGameId)
  }, [selectedGameId])

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
      setViewMoveIndex(null)
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
      loadGames()

      if (getPlayerColor(game, authUser.id)) {
        setGames((current) => {
          const exists = current.some((item) => item.id === game.id)
          const next = exists ? current.map((item) => item.id === game.id ? game : item) : [game, ...current]
          return next
        })
      } else {
        setGames((current) => current.filter((item) => item.id !== game.id))
      }
      setOpenGames((current) => {
        const withoutGame = current.filter((item) => item.id !== game.id)

        if (game.status === 'waiting') {
          return [game, ...withoutGame]
        }

        return withoutGame
      })
      setActiveGames((current) => {
        const withoutGame = current.filter((item) => item.id !== game.id)

        if (game.status === 'active') {
          return [game, ...withoutGame]
        }

        return withoutGame
      })
      setCompletedGames((current) => {
        const withoutGame = current.filter((item) => item.id !== game.id)

        if (isCompletedGame(game)) {
          return [game, ...withoutGame]
        }

        return withoutGame
      })

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
      setViewMoveIndex(null)
      setSelectedSquare(null)
      setMoveError(null)
    }

    socket.on('chess:gameUpdated', handleGameUpdated)
    socket.on('chess:moveMade', handleMoveMade)
    socket.on('chess:gameDeleted', ({ id }) => {
      setGames((current) => current.filter((game) => Number(game.id) !== Number(id)))
      setOpenGames((current) => current.filter((game) => Number(game.id) !== Number(id)))
      setActiveGames((current) => current.filter((game) => Number(game.id) !== Number(id)))
      setCompletedGames((current) => current.filter((game) => Number(game.id) !== Number(id)))

      if (Number(selectedGameId) === Number(id)) {
        setSelectedGameId(null)
        setSelectedGame(null)
        setMoves([])
      }
    })

    return () => {
      socket.off('chess:gameUpdated', handleGameUpdated)
      socket.off('chess:moveMade', handleMoveMade)
      socket.off('chess:gameDeleted')
    }
  }, [authUser.id, loadGames, selectedGameId, socket])

  useEffect(() => {
    movesEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [moves.length])

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

  async function createBotGame() {
    setBusy(true)

    try {
      const data = await requestJson('/api/chess/bot-games', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          color: newGameColor,
          level: botLevel,
        }),
      })

      setSelectedGameId(data.game.id)
      setGames((current) => [data.game, ...current])
      setSelectedGame(data.game)
      setMoves(data.moves || [])
      setViewMoveIndex(null)
      onNotice(`Bot game created at ${data.game.bot_level || botLevel}`)
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
      const game = openGames.find((item) => Number(item.id) === Number(gameId))
      const color = openColorForGame(game)
      const data = await requestJson(`/api/chess/games/${gameId}/join`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ color }),
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
        setViewMoveIndex(null)
        setSelectedSquare(null)
        setMoveError(null)
      },
    )
  }

  function handleSquareClick(square) {
    if (!selectedGame || !canMove || isViewingHistory) {
      return
    }

    const clickedSquare = boardSquares.find((item) => item.square === square)
    const clickedOwnPiece = isOwnPiece(clickedSquare?.piece, playerColor)

    if (!selectedSquare) {
      if (!clickedOwnPiece) {
        return
      }

      setSelectedSquare(square)
      setMoveError(null)
      return
    }

    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    if (clickedOwnPiece) {
      setSelectedSquare(square)
      setMoveError(null)
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

  async function cancelGame() {
    if (!selectedGame) {
      return
    }

    setBusy(true)

    try {
      const data = await requestJson(`/api/chess/games/${selectedGame.id}/cancel`, {
        method: 'POST',
        headers: authHeaders,
      })

      setSelectedGame(data.game)
      onNotice('Game canceled')
      loadGames()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteGame(game) {
    setBusy(true)

    try {
      await requestJson(`/api/chess/games/${game.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })

      setGames((current) => current.filter((item) => item.id !== game.id))
      setCompletedGames((current) => current.filter((item) => item.id !== game.id))

      if (Number(selectedGameId) === Number(game.id)) {
        setSelectedGameId(null)
        setSelectedGame(null)
        setMoves([])
      }

      onNotice('Game deleted')
      loadGames()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function toggleGameExpanded(gameId) {
    setExpandedGameIds((current) => {
      const next = new Set(current)

      if (next.has(gameId)) {
        next.delete(gameId)
      } else {
        next.add(gameId)
      }

      return next
    })
  }

  function showPreviousMove() {
    if (moves.length === 0) {
      return
    }

    setSelectedSquare(null)
    setViewMoveIndex((current) => {
      if (current === null) {
        return moves.length - 1
      }

      return Math.max(0, current - 1)
    })
  }

  function showNextMove() {
    if (moves.length === 0) {
      return
    }

    setSelectedSquare(null)
    setViewMoveIndex((current) => {
      if (current === null) {
        return null
      }

      if (current >= moves.length - 1) {
        return null
      }

      return current + 1
    })
  }

  function handleSelectedGameUpdated(game) {
    setSelectedGame(game)
    setGames((current) => current.map((item) => item.id === game.id ? game : item))
    setCompletedGames((current) => current.map((item) => item.id === game.id ? game : item))
  }

  function renderGameList(items, emptyText, options = {}) {
    if (items.length === 0) {
      return (
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="text.secondary">{emptyText}</Typography>
        </Paper>
      )
    }

    return (
      <List disablePadding>
        {items.map((game) => {
          const action = options.action?.(game)
          const expanded = expandedGameIds.has(game.id)

          return (
            <Box key={game.id} sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={Number(game.id) === Number(selectedGameId)}
                onClick={() => options.onClick ? options.onClick(game) : setSelectedGameId(game.id)}
                disabled={options.disabled?.(game)}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText
                  primary={`${gameTitle(game)} · ${matchupLabel(game)}`}
                  slotProps={{
                    primary: {
                      noWrap: true,
                    },
                  }}
                  sx={{
                    minWidth: 0,
                    mr: 1,
                  }}
                />
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  {game.is_bot_game && !options.hideBotChip && (
                    <Chip size="small" label={`Bot ${game.bot_level}`} variant="outlined" />
                  )}
                  <Chip
                    size="small"
                    label={action || statusLabel(game, authUser)}
                    color={action ? 'primary' : statusColor(game, authUser)}
                    variant="outlined"
                    sx={{ maxWidth: 116 }}
                  />
                  <Box
                    component="span"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleGameExpanded(game.id)
                    }}
                    sx={{ display: 'inline-flex', color: 'text.secondary' }}
                  >
                    {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                  </Box>
                </Stack>
              </ListItemButton>
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Paper variant="outlined" sx={{ mt: 0.5, p: 1.25 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="body2" color="text.secondary">
                      White: {playerName(game, 'white')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Black: {playerName(game, 'black')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Status: {statusLabel(game, authUser)}
                    </Typography>
                    {game.is_bot_game && (
                      <Typography variant="body2" color="text.secondary">
                        Bot level: {game.bot_level}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => options.onClick ? options.onClick(game) : setSelectedGameId(game.id)}
                        disabled={options.disabled?.(game)}
                      >
                        {action || 'View'}
                      </Button>
                      {options.allowDelete && game.can_delete && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<Delete />}
                          onClick={() => deleteGame(game)}
                          disabled={busy}
                        >
                          Delete
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              </Collapse>
            </Box>
          )
        })}
      </List>
    )
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
            <Typography
              variant="h5"
              component="h2"
              sx={{
                color: themeMode === 'dark' ? 'text.primary' : '#05070a',
                fontWeight: 900,
              }}
            >
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
              <ToggleButton value="white">Play as White</ToggleButton>
              <ToggleButton value="black">Play as Black</ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={createGame}
              disabled={busy}
              fullWidth
            >
              New human game
            </Button>
            <Stack direction="row" spacing={1}>
              <TextField
                select
                label="Bot level"
                size="small"
                value={botLevel}
                onChange={(event) => setBotLevel(Number(event.target.value))}
                sx={{ width: 132 }}
              >
                {botLevels.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                startIcon={<SportsEsports />}
                onClick={createBotGame}
                disabled={busy}
                sx={{ flex: 1 }}
              >
                New bot game
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="overline" color="text.secondary">
            My active games
          </Typography>
          {loading ? (
            <Stack sx={{ alignItems: 'center', py: 4 }}>
              <CircularProgress size={26} />
            </Stack>
          ) : (
            renderGameList(myActiveGames, 'No active games')
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Open games
          </Typography>
          {renderGameList(openGames, 'No open games', {
            action: (game) => `Join as ${openColorForGame(game)}`,
            disabled: () => busy,
            onClick: (game) => joinGame(game.id),
          })}

          <Divider sx={{ my: 2 }} />

          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Watch live
          </Typography>
          {renderGameList(watchGames, 'No live games', {
            action: () => 'View',
          })}

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="overline" color="text.secondary">
              Completed games
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={showMyCompletedOnly}
                  onChange={(event) => setShowMyCompletedOnly(event.target.checked)}
                />
              }
              label="Mine"
              sx={{
                mr: 0,
                '& .MuiFormControlLabel-label': {
                  fontSize: 12,
                },
              }}
            />
          </Stack>
          {renderGameList(visibleCompletedGames, 'No completed games', {
            compact: true,
            hideBotChip: true,
            allowDelete: true,
          })}
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
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{
                    color: themeMode === 'dark' ? 'text.primary' : '#05070a',
                    fontWeight: 900,
                  }}
                >
                  {selectedGame ? gameTitle(selectedGame) : 'Board'}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {selectedGame ? matchupLabel(selectedGame) : 'Pick a game'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip label={statusLabel(selectedGame, authUser)} color={statusColor(selectedGame, authUser)} variant="outlined" />
              <Chip label={socketConnected ? 'Live' : 'Offline'} color={socketConnected ? 'success' : 'default'} variant="outlined" />
              {selectedGame && !playerColor && (
                <Chip label="Viewer" variant="outlined" />
              )}
              {selectedGame?.status === 'waiting' && playerColor && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={cancelGame}
                  disabled={busy}
                >
                  Cancel
                </Button>
              )}
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
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 560px) minmax(320px, 1fr)' },
                gap: { xs: 2, lg: 1 },
                alignItems: 'start',
                justifyContent: { xs: 'center', lg: 'start' },
              }}
            >
              <Box>
                {moveError && (
                  <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setMoveError(null)}>
                    {moveError}
                  </Alert>
                )}
                <ChessBoard
                  boardSquares={boardSquares}
                  canMove={canMove}
                  position={viewedFen}
                  playerColor={playerColor}
                  selectedSquare={selectedSquare}
                  themeMode={themeMode}
                  onSquareClick={handleSquareClick}
                />
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                  <Tooltip title="Previous move">
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ChevronLeft />}
                        onClick={showPreviousMove}
                        disabled={moves.length === 0}
                        sx={{ minWidth: 112 }}
                      >
                        Previous
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Next move">
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        endIcon={<ChevronRight />}
                        onClick={showNextMove}
                        disabled={moves.length === 0 || viewMoveIndex === null}
                        sx={{ minWidth: 112 }}
                      >
                        Next
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
                {selectedGame.status === 'active' && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {isViewingHistory ? `Viewing move ${viewMoveIndex + 1}` : !playerColor ? 'Viewing game' : canMove ? 'Your turn' : 'Waiting for opponent'}
                  </Typography>
                )}
              </Box>

              <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    maxHeight: { lg: 245 },
                    overflow: 'auto',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
                    Moves
                  </Typography>
                  {moves.length === 0 ? (
                    <Typography color="text.secondary">No moves yet</Typography>
                  ) : (
                    <Stack spacing={0.75}>
                      {moves.map((move, index) => (
                        <Stack
                          key={`${move.move_number}-${move.san}`}
                          direction="row"
                          spacing={1}
                          onClick={() => {
                            setViewMoveIndex(index)
                            setSelectedSquare(null)
                          }}
                          sx={{
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderRadius: 1,
                            cursor: 'pointer',
                            px: 0.75,
                            py: 0.25,
                            bgcolor: viewMoveIndex === index ? 'action.selected' : 'transparent',
                            '&:hover': {
                              bgcolor: 'action.hover',
                            },
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {move.move_number}. {move.color}
                          </Typography>
                          <Typography sx={{ fontWeight: 800 }}>{move.san}</Typography>
                        </Stack>
                      ))}
                      <Box ref={movesEndRef} />
                    </Stack>
                  )}
                </Paper>
                <ChessGameChat
                  authHeaders={authHeaders}
                  authUser={authUser}
                  game={selectedGame}
                  socket={socket}
                  socketConnected={socketConnected}
                  onError={onError}
                  onGameUpdated={handleSelectedGameUpdated}
                />
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default ChessPage
