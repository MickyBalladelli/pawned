const { Chess } = require('chess.js')

let activeJob = null

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function createSelfPlayPreview() {
  const chess = new Chess()
  return {
    initialFen: chess.fen(),
    currentFen: chess.fen(),
    result: 'in progress',
    moves: [],
  }
}

function appendPreviewMove(game, maxPlies) {
  const chess = new Chess(game.currentFen || game.initialFen)
  const legalMoves = chess.moves({ verbose: true })

  if (chess.isGameOver() || !legalMoves.length || game.moves.length >= maxPlies) {
    return createSelfPlayPreview()
  }

  const move = randomItem(legalMoves)

  chess.move(move)

  return {
    ...game,
    currentFen: chess.fen(),
    result: chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : 'in progress',
    moves: [
      ...game.moves,
      {
        ply: game.moves.length + 1,
        moveNumber: Math.ceil((game.moves.length + 1) / 2),
        color: move.color === 'w' ? 'white' : 'black',
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion || ''}`,
        fen: chess.fen(),
      },
    ],
  }
}

function advanceSelfPlayPreview(job) {
  if (!job.selfPlayGame) {
    job.selfPlayGame = createSelfPlayPreview()
  }

  const now = Date.now()
  const lastMoveAt = job.lastPreviewMoveAt || 0
  const plyDelayMs = job.config?.plyDelayMs || 25
  const elapsed = now - lastMoveAt

  if (elapsed < plyDelayMs) {
    return
  }

  const movesToAdd = Math.min(20, Math.floor(elapsed / plyDelayMs))

  for (let index = 0; index < movesToAdd; index += 1) {
    job.selfPlayGame = appendPreviewMove(job.selfPlayGame, job.config?.maxPlies || 400)
  }

  job.lastPreviewMoveAt = lastMoveAt + movesToAdd * plyDelayMs
}

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
  }
}

function publicJob(job) {
  if (!job) {
    return null
  }

  if (job.status === 'running') {
    advanceSelfPlayPreview(job)
  }

  return {
    id: job.id,
    status: job.status,
    config: job.config,
    startedBy: job.startedBy,
    startedAt: job.startedAt,
    stoppedAt: job.stoppedAt,
    message: job.message,
    selfPlayGame: job.selfPlayGame,
  }
}

function getTrainingJob() {
  return publicJob(activeJob)
}

function startTrainingJob(config, user) {
  if (activeJob?.status === 'running') {
    advanceSelfPlayPreview(activeJob)
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
    selfPlayGame: createSelfPlayPreview(),
    lastPreviewMoveAt: Date.now(),
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

function stopAllTrainingJobs(message = 'Stopped') {
  if (!activeJob || activeJob.status !== 'running') {
    return publicJob(activeJob)
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
