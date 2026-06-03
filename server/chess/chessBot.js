const openingBook = require('../../client/src/data/chessOpenings.json')
const { chooseEngineMoveAsync } = require('./chessBotEngine')

const bossBotLevel = 9999
const botLevels = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, bossBotLevel]
const maxBookPlies = 16

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
  2800: { maxDepth: 8, timeLimitMs: 7500, nodeLimit: 2800000, workerCount: 2 },
  [bossBotLevel]: { maxDepth: 13, timeLimitMs: 22000, nodeLimit: 12000000, workerCount: 4 },
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

function normalizeSan(san) {
  return String(san || '')
    .replace(/[+#]+$/u, '')
    .replace(/[!?]+$/u, '')
}

function bookKey(history) {
  return history.map(normalizeSan).join('\x1f')
}

function createOpeningMoveIndex() {
  const index = new Map()

  for (const opening of openingBook.openings) {
    for (let ply = 0; ply < Math.min(opening.moves.length, maxBookPlies); ply += 1) {
      const history = opening.moves.slice(0, ply)
      const key = bookKey(history)
      const san = opening.moves[ply]
      const moves = index.get(key) || new Map()

      moves.set(san, (moves.get(san) || 0) + 1)
      index.set(key, moves)
    }
  }

  return index
}

const openingMoveIndex = createOpeningMoveIndex()

function chooseOpeningBookMove(chess, moveHistory) {
  if (!Array.isArray(moveHistory) || moveHistory.length >= maxBookPlies) {
    return null
  }

  const candidates = openingMoveIndex.get(bookKey(moveHistory))

  if (!candidates) {
    return null
  }

  const legalMovesBySan = new Map(chess.moves({ verbose: true }).map((move) => [normalizeSan(move.san), move]))
  const bookMove = [...candidates.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([san]) => legalMovesBySan.get(normalizeSan(san)))
    .find(Boolean)

  if (!bookMove) {
    return null
  }

  return {
    from: bookMove.from,
    to: bookMove.to,
    promotion: bookMove.promotion || undefined,
    source: 'opening-book',
    depth: 0,
    nodes: 0,
    score: null,
  }
}

async function chooseBotMove(chess, moveHistory, level, options = {}) {
  const selectedLevel = level === undefined ? moveHistory : level
  const bookMove = chooseOpeningBookMove(chess, Array.isArray(moveHistory) ? moveHistory : [])

  if (bookMove && (!options.rootMoveKeys || options.rootMoveKeys.includes(`${bookMove.from}${bookMove.to}${bookMove.promotion || ''}`))) {
    return bookMove
  }

  const profile = {
    ...getLevelProfile(selectedLevel),
    onBestMove: options.onBestMove,
    onStats: options.onStats,
    rootMoveKeys: options.rootMoveKeys,
  }
  const searchMove = await chooseEngineMoveAsync(chess, profile)

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
  getLevelProfile,
  normalizeBotLevel,
  openingBook,
  getOpeningMatches,
  chooseOpeningBookMove,
  chooseBotMove,
}
