const { createModel, saveModel, tf } = require('./modelStore')
const {
  advanceLiveSelfPlayGame,
  createLiveSelfPlayGame,
  publicLiveGame,
} = require('./selfPlayEngine')
const { saveGame, saveSamples, gamesPath, samplesPath } = require('./trainingStorage')

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
    maxPlies: sanitizePositiveInteger(config.maxPlies, 400, 20, 1000),
    plyDelayMs: sanitizePositiveInteger(config.plyDelayMs, 25, 10, 5000),
    parallelGames: sanitizePositiveInteger(config.parallelGames, 4, 1, 32),
    trainSampleLimit: sanitizePositiveInteger(config.trainSampleLimit, 512, 32, 4096),
  }
}

function publicJob(job) {
  if (!job) {
    return null
  }

  if (job.status === 'running' && (!job.activeGames || job.activeGames.length === 0)) {
    job.activeGames = Array.from(
      { length: job.config?.parallelGames || 4 },
      () => createLiveSelfPlayGame(),
    )
  }

  const startedAtMs = Date.parse(job.startedAt)
  const endedAtMs = job.stoppedAt ? Date.parse(job.stoppedAt) : Date.now()

  return {
    id: job.id,
    status: job.status,
    config: job.config,
    startedBy: job.startedBy,
    startedAt: job.startedAt,
    stoppedAt: job.stoppedAt,
    elapsedMs: Number.isFinite(startedAtMs) ? Math.max(0, endedAtMs - startedAtMs) : 0,
    message: job.message,
    iteration: job.iteration,
    gamesInIteration: job.gamesInIteration,
    totalGames: job.totalGames,
    totalSamples: job.totalSamples,
    lastLoss: job.lastLoss,
    lastCheckpoint: job.lastCheckpoint,
    storage: {
      gamesPath,
      samplesPath,
    },
    selfPlayGame: job.selfPlayGame,
    activeGames: (job.activeGames || []).map(publicLiveGame),
  }
}

function sampleTrainingRows(samples, limit) {
  if (samples.length <= limit) {
    return samples
  }

  const rows = []

  for (let index = 0; index < limit; index += 1) {
    rows.push(samples[Math.floor(Math.random() * samples.length)])
  }

  return rows
}

async function trainOnSamples(job) {
  const rows = sampleTrainingRows(job.pendingSamples, job.config.trainSampleLimit)

  if (!rows.length) {
    return
  }

  const xs = tf.tensor2d(rows.map((row) => row.state))
  const policyY = tf.tensor1d(rows.map((row) => row.action))
  const valueY = tf.tensor2d(rows.map((row) => [row.value]))

  try {
    const loss = await job.model.fit(xs, [policyY, valueY], {
      epochs: 1,
      batchSize: Math.min(64, rows.length),
      shuffle: true,
      verbose: 0,
    })

    const lossValue = Array.isArray(loss.history.loss)
      ? loss.history.loss[0]
      : loss.history.loss

    job.lastLoss = Number(lossValue).toFixed(4)
    job.pendingSamples = []
  } finally {
    xs.dispose()
    policyY.dispose()
    valueY.dispose()
  }
}

async function maybeCheckpoint(job) {
  if (job.iteration <= 0 || job.iteration % job.config.checkpointEvery !== 0) {
    return
  }

  job.lastCheckpoint = await saveModel(job.model, job.id, job.iteration)
}

async function runTrainingStep(job) {
  if (job.status !== 'running') {
    return
  }

  try {
    const explorationRate = Math.max(0.05, 0.35 - job.iteration / Math.max(job.config.iterations, 1))
    const nextGames = []

    for (const activeGame of job.activeGames) {
      const result = advanceLiveSelfPlayGame(activeGame, job.model, {
        maxPlies: job.config.maxPlies,
        explorationRate,
      })

      job.selfPlayGame = publicLiveGame(result.game)

      if (result.completed) {
        const savedGame = publicLiveGame(result.game)

        await saveGame(savedGame)
        await saveSamples(result.samples)

        job.completedGames = [savedGame, ...job.completedGames].slice(0, 12)
        job.pendingSamples.push(...result.samples)
        job.gamesInIteration += 1
        job.totalGames += 1
        job.totalSamples += result.samples.length
        job.message = `Generated game ${job.totalGames}`
        nextGames.push(createLiveSelfPlayGame())
      } else {
        nextGames.push(result.game)
      }
    }

    job.activeGames = nextGames

    if (job.gamesInIteration >= job.config.gamesPerIteration) {
      job.message = `Training iteration ${job.iteration + 1}`
      await trainOnSamples(job)
      job.iteration += 1
      job.gamesInIteration = 0
      await maybeCheckpoint(job)
    }

    if (job.iteration >= job.config.iterations) {
      job.status = 'completed'
      job.stoppedAt = new Date().toISOString()
      job.message = 'Training completed'
      await maybeCheckpoint(job)
      return
    }
  } catch (err) {
    job.status = 'failed'
    job.stoppedAt = new Date().toISOString()
    job.message = err.message
    console.error('RL training failed:', err)
    return
  }

  job.timer = setTimeout(() => runTrainingStep(job), job.config.plyDelayMs)
}

function getTrainingJob() {
  return publicJob(activeJob)
}

function startTrainingJob(config, user) {
  if (activeJob?.status === 'running') {
    return publicJob(activeJob)
  }

  const trainingConfig = sanitizeTrainingConfig(config)

  activeJob = {
    id: `rl-${Date.now()}`,
    status: 'running',
    config: trainingConfig,
    startedBy: {
      id: user.id,
      username: user.username,
    },
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    message: 'Training job started',
    iteration: 0,
    gamesInIteration: 0,
    totalGames: 0,
    totalSamples: 0,
    lastLoss: null,
    lastCheckpoint: null,
    pendingSamples: [],
    selfPlayGame: null,
    activeGames: Array.from({ length: trainingConfig.parallelGames }, () => createLiveSelfPlayGame()),
    completedGames: [],
    model: createModel(),
    timer: null,
  }

  activeJob.timer = setTimeout(() => runTrainingStep(activeJob), 0)

  return publicJob(activeJob)
}

function stopTrainingJob(user) {
  if (!activeJob || activeJob.status !== 'running') {
    return publicJob(activeJob)
  }

  if (activeJob.timer) {
    clearTimeout(activeJob.timer)
  }

  activeJob = {
    ...activeJob,
    status: 'stopped',
    stoppedAt: new Date().toISOString(),
    message: `Stopped by ${user.username}`,
  }

  return publicJob(activeJob)
}

function stopAllTrainingJobs(message = 'Stopped') {
  if (!activeJob || activeJob.status !== 'running') {
    return publicJob(activeJob)
  }

  if (activeJob.timer) {
    clearTimeout(activeJob.timer)
  }

  activeJob = {
    ...activeJob,
    status: 'stopped',
    stoppedAt: new Date().toISOString(),
    message,
  }

  return publicJob(activeJob)
}

module.exports = {
  getTrainingJob,
  startTrainingJob,
  stopAllTrainingJobs,
  stopTrainingJob,
}
