const { createModel, saveModel, tf } = require('./modelStore')
const { loadReplaySamples, saveGame, saveSamples, gamesPath, samplesPath } = require('./trainingStorage')
const { TrainingWorkerPool } = require('./workerPool')

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
    parallelGames: sanitizePositiveInteger(config.parallelGames, 4, 1, 256),
    workerCount: sanitizePositiveInteger(config.workerCount, 4, 1, 32),
    trainSampleLimit: sanitizePositiveInteger(config.trainSampleLimit, 512, 32, 4096),
    trainBatchSize: sanitizePositiveInteger(config.trainBatchSize, 256, 16, 2048),
    replaySampleLimit: sanitizePositiveInteger(config.replaySampleLimit, 50000, 0, 250000),
  }
}

function publicJob(job, options = {}) {
  if (!job) {
    return null
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
    replaySamples: job.replaySamples?.length || 0,
    lastLoss: job.lastLoss,
    lastCheckpoint: job.lastCheckpoint,
    storage: {
      gamesPath,
      samplesPath,
    },
    selfPlayGame: selectPublicGame(job, options.selectedGameId),
    activeGames: (job.activeGames || []).map(summarizeGame),
  }
}

function selectPublicGame(job, selectedGameId) {
  const activeGames = job.activeGames || []
  const selectedGame = activeGames.find((game) => game.id === selectedGameId)

  return selectedGame || job.selfPlayGame || activeGames[0] || null
}

function summarizeGame(game) {
  if (!game) {
    return null
  }

  return {
    id: game.id,
    createdAt: game.createdAt,
    currentFen: game.currentFen,
    result: game.result,
    hitMaxPlies: game.hitMaxPlies,
    plyCount: game.moves?.length || game.plyCount || 0,
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

function buildTrainingRows(job) {
  const limit = job.config.trainSampleLimit
  const replaySamples = job.replaySamples || []

  if (!replaySamples.length) {
    return sampleTrainingRows(job.pendingSamples, limit)
  }

  const pendingLimit = Math.min(job.pendingSamples.length, Math.ceil(limit / 2))
  const replayLimit = limit - pendingLimit
  const rows = [
    ...sampleTrainingRows(job.pendingSamples, pendingLimit),
    ...sampleTrainingRows(replaySamples, replayLimit),
  ]

  return sampleTrainingRows(rows, limit)
}

async function trainOnSamples(job) {
  const rows = buildTrainingRows(job)

  if (!rows.length) {
    return
  }

  const xs = tf.tensor2d(rows.map((row) => row.state))
  const policyY = tf.tensor1d(rows.map((row) => row.action))
  const valueY = tf.tensor2d(rows.map((row) => [row.value]))

  try {
    const loss = await job.model.fit(xs, [policyY, valueY], {
      epochs: 1,
      batchSize: Math.min(job.config.trainBatchSize, rows.length),
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

function normalizeLegalMoves(request) {
  if (request.legalMoves) {
    return request.legalMoves
  }

  return request.legalIndexes.map((action) => ({
    action,
    repeatPenalty: 0,
  }))
}

function selectPolicyAction(legalMoves, scores) {
  const temperature = 0.08
  let bestScore = -Infinity

  const weightedMoves = legalMoves.map((move) => {
    const score = (scores[move.action] || 0) - (move.repeatPenalty || 0)

    if (score > bestScore) {
      bestScore = score
    }

    return {
      action: move.action,
      score,
    }
  })

  const weights = weightedMoves.map((move) => Math.exp((move.score - bestScore) / temperature))
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)
  let cursor = Math.random() * totalWeight

  for (let index = 0; index < weightedMoves.length; index += 1) {
    cursor -= weights[index]

    if (cursor <= 0) {
      return weightedMoves[index].action
    }
  }

  return weightedMoves[0].action
}

function buildChoicesFromPolicy(requestBatches, policyRows) {
  const choicesByWorker = requestBatches.map(() => [])
  let rowIndex = 0

  for (let workerIndex = 0; workerIndex < requestBatches.length; workerIndex += 1) {
    for (const request of requestBatches[workerIndex]) {
      choicesByWorker[workerIndex].push({
        gameId: request.gameId,
        action: selectPolicyAction(normalizeLegalMoves(request), policyRows[rowIndex]),
      })
      rowIndex += 1
    }
  }

  return choicesByWorker
}

function chooseActions(model, requestBatches) {
  const requests = requestBatches.flat()

  if (requests.length === 0) {
    return requestBatches.map(() => [])
  }

  const policyRows = tf.tidy(() => {
    const input = tf.tensor2d(requests.map((request) => request.state))
    const [policy] = model.predict(input)

    return policy.arraySync()
  })

  return buildChoicesFromPolicy(requestBatches, policyRows)
}

function absorbWorkerResults(job, workerResults) {
  const activeGames = []

  for (const result of workerResults) {
    activeGames.push(...result.games)

    for (const completed of result.completed) {
      job.completedGames = [completed.game, ...job.completedGames].slice(0, 12)
      job.pendingSamples.push(...completed.samples)
      job.gamesInIteration += 1
      job.totalGames += 1
      job.totalSamples += completed.samples.length
      job.selfPlayGame = completed.game
      job.message = `Generated game ${job.totalGames}`
    }
  }

  job.activeGames = activeGames
}

async function saveCompletedResults(results) {
  for (const result of results) {
    for (const completed of result.completed) {
      await saveGame(completed.game)
      await saveSamples(completed.samples)
    }
  }
}

async function runTrainingStep(job) {
  if (job.status !== 'running') {
    return
  }

  try {
    const explorationRate = Math.max(0.05, 0.35 - job.iteration / Math.max(job.config.iterations, 1))
    const options = {
      maxPlies: job.config.maxPlies,
      explorationRate,
    }
    const prepared = await job.workerPool.prepare(options)
    const requestBatches = prepared.map((result) => result.requests)

    absorbWorkerResults(job, prepared)
    await saveCompletedResults(prepared)

    const choicesByWorker = chooseActions(job.model, requestBatches)
    const applied = await job.workerPool.apply(choicesByWorker, options)

    absorbWorkerResults(job, applied)
    await saveCompletedResults(applied)

    if (job.gamesInIteration >= job.config.gamesPerIteration) {
      job.message = `Training iteration ${job.iteration + 1}`
      await trainOnSamples(job)
      job.iteration += 1
      job.gamesInIteration -= job.config.gamesPerIteration
      await maybeCheckpoint(job)
    }

    if (job.iteration >= job.config.iterations) {
      job.status = 'completed'
      job.stoppedAt = new Date().toISOString()
      job.message = 'Training completed'
      await maybeCheckpoint(job)
      await job.workerPool?.stop()
      return
    }
  } catch (err) {
    job.status = 'failed'
    job.stoppedAt = new Date().toISOString()
    job.message = err.message
    await job.workerPool?.stop()
    console.error('RL training failed:', err)
    return
  }

  job.timer = setTimeout(() => runTrainingStep(job), job.config.plyDelayMs)
}

function getTrainingJob(options = {}) {
  return publicJob(activeJob, options)
}

async function startTrainingJob(config, user) {
  if (activeJob?.status === 'running') {
    return publicJob(activeJob)
  }

  const trainingConfig = sanitizeTrainingConfig(config)
  const replaySamples = await loadReplaySamples(trainingConfig.replaySampleLimit)

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
    replaySamples,
    selfPlayGame: null,
    activeGames: [],
    completedGames: [],
    model: createModel(),
    workerPool: new TrainingWorkerPool({
      parallelGames: trainingConfig.parallelGames,
      workerCount: trainingConfig.workerCount,
    }),
    timer: null,
  }

  await activeJob.workerPool.start()
  activeJob.activeGames = activeJob.workerPool.latestGames
  activeJob.timer = setTimeout(() => runTrainingStep(activeJob), 0)

  return publicJob(activeJob)
}

async function stopTrainingJob(user) {
  if (!activeJob || activeJob.status !== 'running') {
    return publicJob(activeJob)
  }

  if (activeJob.timer) {
    clearTimeout(activeJob.timer)
  }

  await activeJob.workerPool?.stop()

  activeJob = {
    ...activeJob,
    status: 'stopped',
    stoppedAt: new Date().toISOString(),
    message: `Stopped by ${user.username}`,
  }

  return publicJob(activeJob)
}

async function stopAllTrainingJobs(message = 'Stopped') {
  if (!activeJob || activeJob.status !== 'running') {
    return publicJob(activeJob)
  }

  if (activeJob.timer) {
    clearTimeout(activeJob.timer)
  }

  await activeJob.workerPool?.stop()

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
