const fs = require('fs/promises')
const path = require('path')
const v8 = require('v8')

const dataDir = path.join(__dirname, 'data')
const gamesPath = path.join(dataDir, 'games.binl')
const samplesPath = path.join(dataDir, 'samples.binl')

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true })
}

function encodeRecord(value) {
  const payload = v8.serialize(value)
  const header = Buffer.allocUnsafe(4)

  header.writeUInt32LE(payload.byteLength)

  return Buffer.concat([header, payload])
}

async function appendBinaryRecord(filePath, value) {
  await ensureDataDir()
  await fs.appendFile(filePath, encodeRecord(value))
}

async function saveGame(game) {
  await appendBinaryRecord(gamesPath, game)
}

async function saveSamples(samples) {
  await ensureDataDir()
  const records = samples.map(encodeRecord)

  if (records.length > 0) {
    await fs.appendFile(samplesPath, Buffer.concat(records))
  }
}

module.exports = {
  gamesPath,
  samplesPath,
  saveGame,
  saveSamples,
}
