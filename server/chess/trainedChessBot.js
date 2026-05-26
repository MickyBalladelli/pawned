const { moveToActionIndex } = require('../rlTraining/actionSpace')
const { encodeBoard } = require('../rlTraining/boardEncoding')
const { loadModelFromCheckpoint, readBestCheckpoint, tf } = require('../rlTraining/modelStore')

let cachedModel = null
let cachedCheckpointPath = null
let cachedLoadError = null

async function getTrainedBotStatus() {
  const bestCheckpoint = await readBestCheckpoint()

  return {
    available: Boolean(bestCheckpoint?.path),
    checkpointPath: bestCheckpoint?.path || null,
    loaded: Boolean(cachedModel && cachedCheckpointPath === bestCheckpoint?.path),
    error: cachedLoadError,
  }
}

async function loadTrainedModel() {
  const bestCheckpoint = await readBestCheckpoint()

  if (!bestCheckpoint?.path) {
    cachedLoadError = null
    return null
  }

  if (cachedModel && cachedCheckpointPath === bestCheckpoint.path) {
    return cachedModel
  }

  if (cachedModel) {
    cachedModel.dispose()
    cachedModel = null
  }

  try {
    cachedModel = await loadModelFromCheckpoint(bestCheckpoint.path)
    cachedCheckpointPath = bestCheckpoint.path
    cachedLoadError = null

    return cachedModel
  } catch (err) {
    cachedLoadError = err.message
    cachedCheckpointPath = null

    return null
  }
}

function chooseModelMove(model, chess) {
  const legalMoves = chess.moves({ verbose: true })

  if (!legalMoves.length) {
    return null
  }

  const scores = tf.tidy(() => {
    const input = tf.tensor2d([encodeBoard(chess)])
    const [policy] = model.predict(input)

    return policy.arraySync()[0]
  })
  let bestMove = legalMoves[0]
  let bestScore = -Infinity

  for (const move of legalMoves) {
    const score = scores[moveToActionIndex(move)] || 0

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return {
    from: bestMove.from,
    to: bestMove.to,
    promotion: bestMove.promotion || undefined,
    source: 'trained-rl',
  }
}

async function chooseTrainedBotMove(chess) {
  const model = await loadTrainedModel()

  if (!model) {
    return null
  }

  return chooseModelMove(model, chess)
}

module.exports = {
  chooseTrainedBotMove,
  getTrainedBotStatus,
}
