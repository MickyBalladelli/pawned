let activeJob = null

function sanitizePositiveInteger(value, fallback, min, max) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.floor(number)))
}

function sanitizeTrainingConfig(config = {}) {
  return {
    iterations: sanitizePositiveInteger(config.iterations, 100, 1, 100000),
    gamesPerIteration: sanitizePositiveInteger(config.gamesPerIteration, 32, 1, 10000),
    checkpointEvery: sanitizePositiveInteger(config.checkpointEvery, 10, 1, 10000),
    maxPlies: sanitizePositiveInteger(config.maxPlies, 240, 20, 1000),
  }
}

function publicJob(job) {
  if (!job) {
    return null
  }

  return {
    id: job.id,
    status: job.status,
    config: job.config,
    startedBy: job.startedBy,
    startedAt: job.startedAt,
    stoppedAt: job.stoppedAt,
    message: job.message,
  }
}

function getTrainingJob() {
  return publicJob(activeJob)
}

function startTrainingJob(config, user) {
  if (activeJob?.status === 'running') {
    return publicJob(activeJob)
  }

  activeJob = {
    id: `rl-${Date.now()}`,
    status: 'running',
    config: sanitizeTrainingConfig(config),
    startedBy: {
      id: user.id,
      username: user.username,
    },
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    message: 'Training job started',
  }

  return publicJob(activeJob)
}

function stopTrainingJob(user) {
  if (!activeJob || activeJob.status !== 'running') {
    return publicJob(activeJob)
  }

  activeJob = {
    ...activeJob,
    status: 'stopped',
    stoppedAt: new Date().toISOString(),
    message: `Stopped by ${user.username}`,
  }

  return publicJob(activeJob)
}

module.exports = {
  getTrainingJob,
  startTrainingJob,
  stopTrainingJob,
}
