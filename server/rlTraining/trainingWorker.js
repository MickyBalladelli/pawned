const { parentPort, workerData } = require('worker_threads')
const { Chess } = require('chess.js')
const { moveToActionIndex, moveToUci } = require('./actionSpace')
const { encodeBoard } = require('./boardEncoding')
const { outcomeValue } = require('./rewards')

const pending = new Map()
let games = []

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function createGame() {
  const chess = new Chess()

  return {
    id: `game-${Date.now()}-${workerData.workerId}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    initialFen: chess.fen(),
    currentFen: chess.fen(),
    result: 'in progress',
    hitMaxPlies: false,
    moves: [],
    samples: [],
  }
}

function publicGame(game) {
  return {
    id: game.id,
    createdAt: game.createdAt,
    initialFen: game.initialFen,
    currentFen: game.currentFen,
    result: game.result,
    hitMaxPlies: game.hitMaxPlies,
    moves: game.moves,
  }
}

function summarizeGame(game) {
  return {
    id: game.id,
    createdAt: game.createdAt,
    currentFen: game.currentFen,
    result: game.result,
    hitMaxPlies: game.hitMaxPlies,
    plyCount: game.moves.length,
  }
}

function appendMove(game, chess, state, color, move) {
  chess.move(move)

  const moveRecord = {
    ply: game.moves.length + 1,
    moveNumber: Math.ceil((game.moves.length + 1) / 2),
    color: move.color === 'w' ? 'white' : 'black',
    san: move.san,
    uci: moveToUci(move),
    fen: chess.fen(),
  }

  game.currentFen = chess.fen()
  game.result = chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : 'in progress'
  game.moves.push(moveRecord)
  game.samples.push({
    state,
    action: moveToActionIndex(move),
    color,
    fen: moveRecord.fen,
  })
}

function finishGame(game, chess, hitMaxPlies) {
  game.currentFen = chess.fen()
  game.result = chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : hitMaxPlies ? 'max plies' : 'in progress'
  game.hitMaxPlies = hitMaxPlies

  const samples = game.samples.map((sample) => ({
    ...sample,
    value: outcomeValue(chess, sample.color, hitMaxPlies),
    gameId: game.id,
  }))

  return {
    game: publicGame(game),
    samples,
  }
}

function maybeFinish(index, completed, maxPlies) {
  const game = games[index]
  const chess = new Chess(game.currentFen || game.initialFen)
  const hitMaxPlies = game.moves.length >= maxPlies && !chess.isGameOver()

  if (!chess.isGameOver() && !hitMaxPlies) {
    return false
  }

  completed.push(finishGame(game, chess, hitMaxPlies))
  games[index] = createGame()
  return true
}

function prepare(options) {
  const completed = []
  const requests = []

  for (let index = 0; index < games.length; index += 1) {
    if (maybeFinish(index, completed, options.maxPlies)) {
      continue
    }

    const game = games[index]
    const chess = new Chess(game.currentFen || game.initialFen)
    const legalMoves = chess.moves({ verbose: true })
    const color = chess.turn()
    const state = encodeBoard(chess)

    if (!legalMoves.length) {
      completed.push(finishGame(game, chess, false))
      games[index] = createGame()
      continue
    }

    if (Math.random() < options.explorationRate) {
      appendMove(game, chess, state, color, randomItem(legalMoves))
      maybeFinish(index, completed, options.maxPlies)
      continue
    }

    pending.set(game.id, {
      index,
      chessFen: chess.fen(),
      color,
      legalMoves,
      state,
    })

    requests.push({
      gameId: game.id,
      state,
      legalIndexes: legalMoves.map(moveToActionIndex),
    })
  }

  return {
    completed,
    requests,
    games: games.map(publicGame),
  }
}

function applyChoices(choices, options) {
  const completed = []

  for (const choice of choices) {
    const item = pending.get(choice.gameId)

    if (!item) {
      continue
    }

    pending.delete(choice.gameId)

    const game = games[item.index]
    const chess = new Chess(item.chessFen)
    const move = item.legalMoves.find((legalMove) => moveToActionIndex(legalMove) === choice.action)
      || randomItem(item.legalMoves)

    appendMove(game, chess, item.state, item.color, move)
    maybeFinish(item.index, completed, options.maxPlies)
  }

  return {
    completed,
    games: games.map(publicGame),
  }
}

parentPort.on('message', (message) => {
  if (message.type === 'init') {
    games = Array.from({ length: message.gameCount }, () => createGame())
    parentPort.postMessage({
      id: message.id,
      games: games.map(publicGame),
    })
    return
  }

  if (message.type === 'prepare') {
    parentPort.postMessage({
      id: message.id,
      ...prepare(message.options),
    })
    return
  }

  if (message.type === 'apply') {
    parentPort.postMessage({
      id: message.id,
      ...applyChoices(message.choices, message.options),
    })
  }
})
