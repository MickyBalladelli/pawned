const { Chess } = require('chess.js')

let activeJob = null

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function generateSelfPlayPreview(maxPlies) {
  const chess = new Chess()
  const moves = []
  const plies = Math.min(maxPlies, 48)

  while (!chess.isGameOver() && moves.length < plies) {
    const legalMoves = chess.moves({ verbose: true })
    const move = randomItem(legalMoves)

    chess.move(move)
    moves.push({
      ply: moves.length + 1,
      moveNumber: Math.ceil((moves.length + 1) / 2),
      color: move.color === 'w' ? 'white' : 'black',
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion || ''}`,
      fen: chess.fen(),
    })
  }

  return {
    initialFen: new Chess().fen(),
    currentFen: chess.fen(),
    result: chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : 'in progress',
    moves,
  }
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
    selfPlayGame: job.selfPlayGame,
  }
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
    selfPlayGame: generateSelfPlayPreview(trainingConfig.maxPlies),
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
