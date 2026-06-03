import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { Timer } from '@mui/icons-material'

const bossBotLevel = 9999

function botLevelLabel(level) {
  if (Number(level) === bossBotLevel) {
    return 'boss-level'
  }

  return String(level || '')
}

function playerName(game, color) {
  if (game?.is_bot_game) {
    const username = color === 'white' ? game?.white_username : game?.black_username

    if (username === 'PawnedBot') {
      return `Bot ${botLevelLabel(game.bot_level)}`.trim()
    }
  }

  return color === 'white'
    ? game?.white_username || 'Open'
    : game?.black_username || 'Open'
}

function formatClock(ms) {
  if (ms === null || ms === undefined) {
    return 'Unlimited'
  }

  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function timeControlName(seconds) {
  if (!seconds) {
    return 'Unlimited'
  }

  if (seconds === 60) {
    return 'Bullet'
  }

  if (seconds === 300) {
    return 'Blitz'
  }

  if (seconds === 600) {
    return 'Rapid'
  }

  if (seconds === 5400) {
    return 'Classical'
  }

  return `${seconds / 60} min`
}

function clockStartedMs(game) {
  const value = game?.clock_started_at ? new Date(game.clock_started_at).getTime() : null
  return Number.isFinite(value) ? value : null
}

function getClockTimes(game, now) {
  const white = game?.white_time_ms ?? null
  const black = game?.black_time_ms ?? null

  if (!game?.time_control_seconds || game.status !== 'active') {
    return { white, black }
  }

  const startedMs = clockStartedMs(game)

  if (!startedMs) {
    return { white, black }
  }

  const elapsed = Math.max(0, now - startedMs)

  return {
    white: game.turn_color === 'white' ? Math.max(0, white - elapsed) : white,
    black: game.turn_color === 'black' ? Math.max(0, black - elapsed) : black,
  }
}

function ChessClock({ game, playerColor, title, subtitle, onTimeout }) {
  const [now, setNow] = useState(Date.now())
  const timeoutSentRef = useRef(null)
  const times = useMemo(() => getClockTimes(game, now), [game, now])
  const activeRemaining = game?.turn_color === 'white' ? times.white : times.black

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (game?.status !== 'active' || !game.time_control_seconds || activeRemaining > 0) {
      return
    }

    const key = `${game.id}:${game.turn_color}:${game.updated_at}`

    if (timeoutSentRef.current === key) {
      return
    }

    timeoutSentRef.current = key
    onTimeout?.(game.id)
  }, [activeRemaining, game, onTimeout])

  if (!game) {
    return null
  }

  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }} noWrap>
              {title || 'Chess'}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexShrink: 0 }}>
            <Chip
              size="small"
              icon={<Timer fontSize="small" />}
              variant="outlined"
              label={timeControlName(game.time_control_seconds)}
            />
            {playerColor && (
              <Chip size="small" variant="outlined" label={`You: ${playerColor}`} />
            )}
          </Stack>
        </Stack>
        {['white', 'black'].map((color) => {
          const active = game.status === 'active' && game.turn_color === color
          const own = playerColor === color

          return (
            <Box
              key={color}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 1,
                alignItems: 'center',
                borderRadius: 1,
                bgcolor: active ? 'action.selected' : 'transparent',
                px: 1,
                py: 0.75,
              }}
            >
              <Typography variant="body2" noWrap sx={{ fontWeight: own ? 900 : 600 }}>
                {color === 'white' ? 'White' : 'Black'} · {playerName(game, color)}
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {formatClock(color === 'white' ? times.white : times.black)}
              </Typography>
            </Box>
          )
        })}
      </Stack>
    </Paper>
  )
}

export { timeControlName }
export default ChessClock
