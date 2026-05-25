const fs = require('fs')
const fsPromises = require('fs/promises')
const path = require('path')
const readline = require('readline')
const v8 = require('v8')

const dataDir = path.join(__dirname, 'data')
const gamesPath = path.join(dataDir, 'games.binl')
const samplesPath = path.join(dataDir, 'samples.binl')
const legacySamplesPath = path.join(dataDir, 'samples.jsonl')

async function ensureDataDir() {
  await fsPromises.mkdir(dataDir, { recursive: true })
}

function encodeRecord(value) {
  const payload = v8.serialize(value)
  const header = Buffer.allocUnsafe(4)

  header.writeUInt32LE(payload.byteLength)

  return Buffer.concat([header, payload])
}

async function appendBinaryRecord(filePath, value) {
  await ensureDataDir()
  await fsPromises.appendFile(filePath, encodeRecord(value))
}

async function saveGame(game) {
  await appendBinaryRecord(gamesPath, game)
}

async function saveSamples(samples) {
  await ensureDataDir()
  const records = samples.map(encodeRecord)

  if (records.length > 0) {
    await fsPromises.appendFile(samplesPath, Buffer.concat(records))
  }
}

function isTrainableSample(sample) {
  return Array.isArray(sample?.state)
    && Number.isFinite(Number(sample.action))
    && Number.isFinite(Number(sample.value))
}

function addReplaySample(state, sample, limit) {
  if (state.samples.length >= limit) {
    return
  }

  if (!isTrainableSample(sample)) {
    return
  }

  state.samples.push(sample)
}

function readBinaryReplaySamples(filePath, state, limit) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath) || limit <= 0) {
      resolve()
      return
    }

    let buffer = Buffer.alloc(0)
    let settled = false
    const stream = fs.createReadStream(filePath)
    const finish = () => {
      if (settled) {
        return
      }

      settled = true
      resolve()
    }

    stream.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])

      while (buffer.length >= 4) {
        const size = buffer.readUInt32LE(0)

        if (buffer.length < size + 4) {
          break
        }

        try {
          addReplaySample(state, v8.deserialize(buffer.subarray(4, size + 4)), limit)
        } catch {
        }

        buffer = buffer.subarray(size + 4)

        if (state.samples.length >= limit) {
          stream.destroy()
          finish()
          return
        }
      }
    })
    stream.on('end', finish)
    stream.on('close', finish)
    stream.on('error', reject)
  })
}

async function readLegacyReplaySamples(filePath, state, limit) {
  if (!fs.existsSync(filePath) || limit <= 0 || state.samples.length >= limit) {
    return
  }

  const lines = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  })

  for await (const line of lines) {
    if (!line) {
      continue
    }

    try {
      addReplaySample(state, JSON.parse(line), limit)
    } catch {
    }

    if (state.samples.length >= limit) {
      lines.close()
      return
    }
  }
}

async function loadReplaySamples(limit) {
  const state = {
    samples: [],
  }

  await readBinaryReplaySamples(samplesPath, state, limit)
  await readLegacyReplaySamples(legacySamplesPath, state, limit)

  return state.samples
}

module.exports = {
  gamesPath,
  loadReplaySamples,
  samplesPath,
  saveGame,
  saveSamples,
}
