const fs = require('fs/promises')
const path = require('path')

const dataDir = path.join(__dirname, 'data')
const gamesPath = path.join(dataDir, 'games.jsonl')
const samplesPath = path.join(dataDir, 'samples.jsonl')

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true })
}

async function appendJsonLine(filePath, value) {
  await ensureDataDir()
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`)
}

async function saveGame(game) {
  await appendJsonLine(gamesPath, game)
}

async function saveSamples(samples) {
  await ensureDataDir()
  const lines = samples.map((sample) => JSON.stringify(sample)).join('\n')

  if (lines) {
    await fs.appendFile(samplesPath, `${lines}\n`)
  }
}

module.exports = {
  gamesPath,
  samplesPath,
  saveGame,
  saveSamples,
}
