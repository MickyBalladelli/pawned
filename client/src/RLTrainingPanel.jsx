import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { PlayArrow, Stop, Sync } from '@mui/icons-material'
import RLTrainingGameViewer from './RLTrainingGameViewer'
import { requestJson } from './requestJson'

const defaultConfig = {
  iterations: 100,
  gamesPerIteration: 32,
  checkpointEvery: 10,
  maxPlies: 400,
  plyDelayMs: 25,
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function numericFieldValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function RLTrainingPanel({ authToken, themeMode }) {
  const [config, setConfig] = useState(defaultConfig)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const authHeaders = useMemo(() => (
    authToken ? { Authorization: `Bearer ${authToken}` } : {}
  ), [authToken])
  const isRunning = job?.status === 'running'

  async function loadJob() {
    setError(null)

    try {
      const data = await requestJson('/api/rl-training/job', {
        headers: authHeaders,
      })
      setJob(data.job)
    } catch (err) {
      if (err.status === 401) {
        setJob((current) => current ? {
          ...current,
          status: 'stopped',
          message: 'Stopped because authentication was required',
        } : current)
      }

      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    requestJson('/api/rl-training/job', {
      headers: authHeaders,
    })
      .then((data) => {
        if (active) {
          setJob(data.job)
        }
      })
      .catch((err) => {
        if (active) {
          if (err.status === 401) {
            setJob((current) => current ? {
              ...current,
              status: 'stopped',
              message: 'Stopped because authentication was required',
            } : current)
          }

          setError(err.message)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [authHeaders])

  useEffect(() => {
    if (!isRunning) {
      return undefined
    }

    const pollDelay = Math.max(50, Math.min(500, config.plyDelayMs || 100))
    const interval = window.setInterval(() => {
      loadJob()
    }, pollDelay)

    return () => {
      window.clearInterval(interval)
    }
  }, [config.plyDelayMs, isRunning])

  function updateConfig(field, value) {
    setConfig((current) => ({
      ...current,
      [field]: numericFieldValue(value),
    }))
  }

  async function startTraining() {
    setSaving(true)
    setError(null)

    try {
      const data = await requestJson('/api/rl-training/job', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(config),
      })
      setJob(data.job)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function stopTraining() {
    setSaving(true)
    setError(null)

    try {
      const data = await requestJson('/api/rl-training/job/stop', {
        method: 'POST',
        headers: authHeaders,
      })
      setJob(data.job)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Stack sx={{ alignItems: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Stack>
    )
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography
            variant="h5"
            component="h2"
            sx={{
              color: themeMode === 'dark' ? 'text.primary' : '#05070a',
              fontWeight: 900,
            }}
          >
            RL Agent Training
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Self-play chess worker
          </Typography>
        </Box>
        <Chip
          label={job?.status || 'idle'}
          color={isRunning ? 'success' : 'default'}
          variant={isRunning ? 'filled' : 'outlined'}
        />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ alignItems: 'stretch' }}
          >
            <TextField
              label="Iterations"
              type="number"
              size="small"
              value={config.iterations}
              onChange={(event) => updateConfig('iterations', event.target.value)}
              inputProps={{ min: 1 }}
              fullWidth
              disabled={isRunning || saving}
            />
            <TextField
              label="Games / iteration"
              type="number"
              size="small"
              value={config.gamesPerIteration}
              onChange={(event) => updateConfig('gamesPerIteration', event.target.value)}
              inputProps={{ min: 1 }}
              fullWidth
              disabled={isRunning || saving}
            />
            <TextField
              label="Checkpoint every"
              type="number"
              size="small"
              value={config.checkpointEvery}
              onChange={(event) => updateConfig('checkpointEvery', event.target.value)}
              inputProps={{ min: 1 }}
              fullWidth
              disabled={isRunning || saving}
            />
            <TextField
              label="Max plies"
              type="number"
              size="small"
              value={config.maxPlies}
              onChange={(event) => updateConfig('maxPlies', event.target.value)}
              inputProps={{ min: 20 }}
              fullWidth
              disabled={isRunning || saving}
            />
            <TextField
              label="Ply delay (ms)"
              type="number"
              size="small"
              value={config.plyDelayMs}
              onChange={(event) => updateConfig('plyDelayMs', event.target.value)}
              inputProps={{ min: 10 }}
              fullWidth
              disabled={isRunning || saving}
            />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={saving && !isRunning ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
              onClick={startTraining}
              disabled={isRunning || saving}
            >
              Start training
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={saving && isRunning ? <CircularProgress size={16} color="inherit" /> : <Stop />}
              onClick={stopTraining}
              disabled={!isRunning || saving}
            >
              Stop
            </Button>
            <Button
              variant="text"
              startIcon={<Sync />}
              onClick={loadJob}
              disabled={saving}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.25}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Current job
          </Typography>
          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Chip label={`ID: ${job?.id || '-'}`} variant="outlined" />
            <Chip label={`Started: ${formatDate(job?.startedAt)}`} variant="outlined" />
            <Chip label={`By: ${job?.startedBy?.username || '-'}`} variant="outlined" />
          </Stack>
          {job?.config && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Chip label={`${job.config.iterations} iterations`} variant="outlined" />
              <Chip label={`${job.config.gamesPerIteration} games`} variant="outlined" />
              <Chip label={`${job.config.checkpointEvery} checkpoint`} variant="outlined" />
              <Chip label={`${job.config.maxPlies} plies`} variant="outlined" />
              <Chip label={`${job.config.plyDelayMs}ms / ply`} variant="outlined" />
            </Stack>
          )}
          <Typography variant="body2" color="text.secondary">
            {job?.message || 'No job yet'}
          </Typography>
        </Stack>
      </Paper>

      <RLTrainingGameViewer game={job?.selfPlayGame} themeMode={themeMode} />
    </Stack>
  )
}

export default RLTrainingPanel
