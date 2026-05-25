const fs = require('fs/promises')
const path = require('path')
let tf

try {
  tf = require('@tensorflow/tfjs-node')
} catch {
  tf = require('@tensorflow/tfjs')
}
const { actionCount } = require('./actionSpace')
const { inputSize } = require('./boardEncoding')

const checkpointDir = path.join(__dirname, 'checkpoints')

function compileModel(model) {
  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: ['sparseCategoricalCrossentropy', 'meanSquaredError'],
  })
}

function createModel() {
  const input = tf.input({ shape: [inputSize] })
  const dense1 = tf.layers.dense({ units: 128, activation: 'relu' }).apply(input)
  const dense2 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(dense1)
  const policy = tf.layers.dense({ units: actionCount, activation: 'softmax', name: 'policy' }).apply(dense2)
  const value = tf.layers.dense({ units: 1, activation: 'tanh', name: 'value' }).apply(dense2)
  const model = tf.model({ inputs: input, outputs: [policy, value] })

  compileModel(model)

  return model
}

async function ensureCheckpointDir() {
  await fs.mkdir(checkpointDir, { recursive: true })
}

async function saveModel(model, jobId, iteration) {
  await ensureCheckpointDir()

  const savePath = path.join(checkpointDir, `${jobId}-iteration-${iteration}.json`)
  await model.save(tf.io.withSaveHandler(async (artifacts) => {
    await fs.writeFile(savePath, JSON.stringify({
      modelTopology: artifacts.modelTopology,
      weightSpecs: artifacts.weightSpecs,
      weightData: Buffer.from(artifacts.weightData).toString('base64'),
    }))

    return {
      modelArtifactsInfo: {
        dateSaved: new Date(),
        modelTopologyType: 'JSON',
        weightDataBytes: artifacts.weightData.byteLength,
      },
    }
  }))

  return savePath
}

async function getLatestCheckpointPath() {
  try {
    const entries = await fs.readdir(checkpointDir)
    const checkpoints = await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.json'))
        .map(async (entry) => {
          const filePath = path.join(checkpointDir, entry)
          const stat = await fs.stat(filePath)

          return {
            filePath,
            mtimeMs: stat.mtimeMs,
          }
        }),
    )

    checkpoints.sort((left, right) => right.mtimeMs - left.mtimeMs)

    return checkpoints[0]?.filePath || null
  } catch {
    return null
  }
}

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

async function loadModelFromCheckpoint(checkpointPath) {
  const checkpoint = JSON.parse(await fs.readFile(checkpointPath, 'utf8'))
  const weightBuffer = Buffer.from(checkpoint.weightData, 'base64')
  const model = await tf.loadLayersModel({
    load: async () => ({
      modelTopology: checkpoint.modelTopology,
      weightSpecs: checkpoint.weightSpecs,
      weightData: bufferToArrayBuffer(weightBuffer),
    }),
  })

  compileModel(model)

  return model
}

async function createOrLoadModel() {
  const checkpointPath = await getLatestCheckpointPath()

  if (!checkpointPath) {
    return {
      model: createModel(),
      checkpointPath: null,
    }
  }

  try {
    return {
      model: await loadModelFromCheckpoint(checkpointPath),
      checkpointPath,
    }
  } catch (err) {
    console.error('Failed to load latest checkpoint:', err)

    return {
      model: createModel(),
      checkpointPath: null,
    }
  }
}

module.exports = {
  createOrLoadModel,
  createModel,
  getLatestCheckpointPath,
  loadModelFromCheckpoint,
  saveModel,
  tf,
}
