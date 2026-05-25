const fs = require('fs/promises')
const path = require('path')
const tf = require('@tensorflow/tfjs')
const { actionCount } = require('./actionSpace')
const { inputSize } = require('./boardEncoding')

const checkpointDir = path.join(__dirname, 'checkpoints')

function createModel() {
  const input = tf.input({ shape: [inputSize] })
  const dense1 = tf.layers.dense({ units: 128, activation: 'relu' }).apply(input)
  const dense2 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(dense1)
  const policy = tf.layers.dense({ units: actionCount, activation: 'softmax', name: 'policy' }).apply(dense2)
  const value = tf.layers.dense({ units: 1, activation: 'tanh', name: 'value' }).apply(dense2)
  const model = tf.model({ inputs: input, outputs: [policy, value] })

  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: ['sparseCategoricalCrossentropy', 'meanSquaredError'],
  })

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

module.exports = {
  createModel,
  saveModel,
  tf,
}
