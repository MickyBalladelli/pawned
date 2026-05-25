import { useState } from 'react'
import {
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { ExpandLess, ExpandMore } from '@mui/icons-material'

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

function formatDuration(milliseconds = 0) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

function RLTrainingCurrentJob({ job, totalGamesRemaining }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Current job
          </Typography>
          <IconButton
            size="small"
            aria-label={expanded ? 'Collapse current job' : 'Expand current job'}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip label={`Status: ${job?.status || 'idle'}`} variant="outlined" />
          <Chip label={`Games: ${job?.totalGames || 0}`} variant="outlined" />
          <Chip label={`Total left: ${totalGamesRemaining}`} variant="outlined" />
          <Chip label={`Loss: ${job?.lastLoss || '-'}`} variant="outlined" />
        </Stack>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Stack spacing={1.25}>
            <Divider />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Chip label={`ID: ${job?.id || '-'}`} variant="outlined" />
              <Chip label={`Started: ${formatDate(job?.startedAt)}`} variant="outlined" />
              <Chip label={`Time: ${formatDuration(job?.elapsedMs)}`} variant="outlined" />
              <Chip label={`By: ${job?.startedBy?.username || '-'}`} variant="outlined" />
            </Stack>
            {job?.config && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Chip label={`${job.config.iterations} iterations`} variant="outlined" />
                <Chip label={`${job.config.gamesPerIteration} games`} variant="outlined" />
                <Chip label={`${job.config.checkpointEvery} checkpoint`} variant="outlined" />
                <Chip label={`${job.config.maxPlies} plies`} variant="outlined" />
                <Chip label={`${job.config.plyDelayMs}ms / ply`} variant="outlined" />
                <Chip label={`${job.config.parallelGames} parallel games`} variant="outlined" />
                <Chip label={`${job.config.workerCount} workers`} variant="outlined" />
                <Chip label={`${job.config.trainSampleLimit} train samples`} variant="outlined" />
                <Chip label={`${job.config.trainBatchSize} train batch`} variant="outlined" />
                <Chip label={`${job.config.replaySampleLimit ?? 0} replay samples`} variant="outlined" />
              </Stack>
            )}
            {job && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Chip label={`Iteration: ${job.iteration || 0}`} variant="outlined" />
                <Chip label={`Active: ${job.activeGames?.length || 0}`} variant="outlined" />
                <Chip label={`Samples: ${job.totalSamples || 0}`} variant="outlined" />
                <Chip label={`Replay: ${job.replaySamples || 0}`} variant="outlined" />
              </Stack>
            )}
            <Typography variant="body2" color="text.secondary">
              {job?.message || 'No job yet'}
            </Typography>
            {job?.storage && (
              <Typography variant="caption" color="text.secondary">
                Data: {job.storage.gamesPath} / {job.storage.samplesPath}
              </Typography>
            )}
            {job?.lastCheckpoint && (
              <Typography variant="caption" color="text.secondary">
                Checkpoint: {job.lastCheckpoint}
              </Typography>
            )}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  )
}

export default RLTrainingCurrentJob
