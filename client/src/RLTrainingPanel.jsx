import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ExpandLess, ExpandMore, PlayArrow, Stop, Sync } from '@mui/icons-material'
import RLTrainingCurrentJob from './RLTrainingCurrentJob'
import RLTrainingGameViewer from './RLTrainingGameViewer'
import { requestJson } from './requestJson'

const defaultConfig = {
  iterations: 100,
  gamesPerIteration: 32,
  checkpointEvery: 10,
  maxPlies: 400,
  plyDelayMs: 25,
  parallelGames: 4,
  workerCount: 4,
  trainSampleLimit: 512,
  trainBatchSize: 256,
  replaySampleLimit: 50000,
}
const trainingConfigStorageKey = 'vela.rlTraining.config'

function readStoredConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(trainingConfigStorageKey) || '{}')

    return {
      ...defaultConfig,
      ...Object.fromEntries(
        Object.keys(defaultConfig).map((key) => [key, numericFieldValue(stored[key] ?? defaultConfig[key])]),
      ),
    }
  } catch {
    return defaultConfig
  }
}

function numericFieldValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function configDiffers(left, right) {
  if (!left || !right) {
    return false
  }

  return Object.keys(defaultConfig).some((key) => numericFieldValue(left[key]) !== numericFieldValue(right[key]))
}

function RLTrainingPanel({
  authToken,
  selectedGameId,
  themeMode,
  onJobChange,
  onSelectedGameIdChange,
}) {
  const [config, setConfig] = useState(readStoredConfig)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [parametersExpanded, setParametersExpanded] = useState(true)
  const authHeaders = useMemo(() => (
    authToken ? { Authorization: `Bearer ${authToken}` } : {}
  ), [authToken])
  const isRunning = job?.status === 'running'
  const runningJobUsesDifferentConfig = Boolean(isRunning && configDiffers(config, job?.config))
  const totalGamesRemaining = job?.config
    ? Math.max(0, ((job.config.iterations || 0) * (job.config.gamesPerIteration || 0)) - (job.totalGames || 0))
    : 0

  async function loadJob() {
    setError(null)
    const params = selectedGameId ? `?selectedGameId=${encodeURIComponent(selectedGameId)}` : ''

    try {
      const data = await requestJson(`/api/rl-training/job${params}`, {
        headers: authHeaders,
      })
      setJob(data.job)
      onJobChange?.(data.job)
    } catch (err) {
      if (err.status === 401) {
        setJob((current) => current ? {
          ...current,
          status: 'stopped',
          message: 'Stopped because authentication was required',
        } : current)
        onJobChange?.(null)
      }

      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    const params = selectedGameId ? `?selectedGameId=${encodeURIComponent(selectedGameId)}` : ''

    requestJson(`/api/rl-training/job${params}`, {
      headers: authHeaders,
    })
      .then((data) => {
        if (active) {
          setJob(data.job)
          onJobChange?.(data.job)
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
            onJobChange?.(null)
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
  }, [authHeaders, selectedGameId])

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
  }, [config.plyDelayMs, isRunning, selectedGameId])

  function updateConfig(field, value) {
    setConfig((current) => ({
      ...current,
      [field]: numericFieldValue(value),
    }))
  }

  useEffect(() => {
    localStorage.setItem(trainingConfigStorageKey, JSON.stringify(config))
  }, [config])

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
      onJobChange?.(data.job)
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
      onJobChange?.(data.job)
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
      {runningJobUsesDifferentConfig && (
        <Alert severity="info">
          Running job uses settings from when it started. Stop and start to apply current settings.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Training controls
            </Typography>
            <IconButton
              size="small"
              aria-label={parametersExpanded ? 'Collapse training parameters' : 'Expand training parameters'}
              onClick={() => setParametersExpanded((current) => !current)}
            >
              {parametersExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          </Stack>

          <Collapse in={parametersExpanded} timeout="auto" unmountOnExit>
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
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
                <TextField
                  label="Games / iteration"
                  type="number"
                  size="small"
                  value={config.gamesPerIteration}
                  onChange={(event) => updateConfig('gamesPerIteration', event.target.value)}
                  inputProps={{ min: 1 }}
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
                <TextField
                  label="Checkpoint every"
                  type="number"
                  size="small"
                  value={config.checkpointEvery}
                  onChange={(event) => updateConfig('checkpointEvery', event.target.value)}
                  inputProps={{ min: 1 }}
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
                <TextField
                  label="Max plies"
                  type="number"
                  size="small"
                  value={config.maxPlies}
                  onChange={(event) => updateConfig('maxPlies', event.target.value)}
                  inputProps={{ min: 20 }}
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
              </Stack>

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{ alignItems: 'stretch' }}
              >
                <TextField
                  label="Ply delay (ms)"
                  type="number"
                  size="small"
                  value={config.plyDelayMs}
                  onChange={(event) => updateConfig('plyDelayMs', event.target.value)}
                  inputProps={{ min: 10 }}
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
                <TextField
                  label="Parallel games"
                  type="number"
                  size="small"
                  value={config.parallelGames}
                  onChange={(event) => updateConfig('parallelGames', event.target.value)}
                  inputProps={{ min: 1 }}
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
                <TextField
                  label="Workers"
                  type="number"
                  size="small"
                  value={config.workerCount}
                  onChange={(event) => updateConfig('workerCount', event.target.value)}
                  inputProps={{ min: 1 }}
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
                <TextField
                  label="Train samples"
                  type="number"
                  size="small"
                  value={config.trainSampleLimit}
                  onChange={(event) => updateConfig('trainSampleLimit', event.target.value)}
                  inputProps={{ min: 32 }}
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
                <TextField
                  label="Train batch"
                  type="number"
                  size="small"
                  value={config.trainBatchSize}
                  onChange={(event) => updateConfig('trainBatchSize', event.target.value)}
                  inputProps={{ min: 16 }}
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
                <TextField
                  label="Replay samples"
                  type="number"
                  size="small"
                  value={config.replaySampleLimit}
                  onChange={(event) => updateConfig('replaySampleLimit', event.target.value)}
                  inputProps={{ min: 0 }}
                  sx={{ flex: 1 }}
                  disabled={isRunning || saving}
                />
              </Stack>
            </Stack>
          </Collapse>

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

      <RLTrainingCurrentJob
        job={job}
        totalGamesRemaining={totalGamesRemaining}
      />

      <RLTrainingGameViewer
        games={job?.activeGames || []}
        fallbackGame={job?.selfPlayGame}
        elapsedMs={job?.elapsedMs || 0}
        selectedGameId={selectedGameId}
        themeMode={themeMode}
        onSelectedGameIdChange={onSelectedGameIdChange}
      />
    </Stack>
  )
}

export default RLTrainingPanel
