const openingBook = require('../../client/src/data/chessOpenings.json')
const { chooseEngineMove } = require('./chessBotEngine')

const bossBotLevel = 9999
const botLevels = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, bossBotLevel]

const levelProfiles = {
  600: { maxDepth: 2, timeLimitMs: 350, nodeLimit: 35000 },
  800: { maxDepth: 3, timeLimitMs: 450, nodeLimit: 55000 },
  1000: { maxDepth: 3, timeLimitMs: 600, nodeLimit: 80000 },
  1200: { maxDepth: 4, timeLimitMs: 750, nodeLimit: 120000 },
  1400: { maxDepth: 4, timeLimitMs: 950, nodeLimit: 170000 },
  1600: { maxDepth: 5, timeLimitMs: 1200, nodeLimit: 240000 },
  1800: { maxDepth: 5, timeLimitMs: 1600, nodeLimit: 360000 },
  2000: { maxDepth: 6, timeLimitMs: 2200, nodeLimit: 550000 },
  2200: { maxDepth: 6, timeLimitMs: 3000, nodeLimit: 850000 },
  2400: { maxDepth: 7, timeLimitMs: 4200, nodeLimit: 1300000 },
  2600: { maxDepth: 7, timeLimitMs: 5600, nodeLimit: 1900000 },
  2800: { maxDepth: 8, timeLimitMs: 7500, nodeLimit: 2800000 },
  [bossBotLevel]: { maxDepth: 10, timeLimitMs: 15000, nodeLimit: 8000000 },
}

function normalizeBotLevel(level) {
  const numericLevel = Number(level)

  if (botLevels.includes(numericLevel)) {
    return numericLevel
  }

  return 800
}

function getLevelProfile(level) {
  return levelProfiles[normalizeBotLevel(level)]
}

function getOpeningMatches(history) {
  return openingBook.openings.filter((opening) => {
    if (history.length >= opening.moves.length) {
      return false
    }

    return history.every((move, index) => opening.moves[index] === move)
  })
}

function chooseBotMove(chess, moveHistory, level) {
  const selectedLevel = level === undefined ? moveHistory : level
  const profile = getLevelProfile(selectedLevel)
  const searchMove = chooseEngineMove(chess, profile)

  if (!searchMove) {
    return null
  }

  return {
    from: searchMove.from,
    to: searchMove.to,
    promotion: searchMove.promotion || undefined,
    source: 'engine-search',
    depth: searchMove.depth,
    nodes: searchMove.nodes,
    score: searchMove.score,
  }
}

module.exports = {
  bossBotLevel,
  botLevels,
  normalizeBotLevel,
  openingBook,
  getOpeningMatches,
  chooseBotMove,
}
