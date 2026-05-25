const { Chess } = require('chess.js')
const { moveToActionIndex, moveToUci } = require('./actionSpace')
const { encodeBoard } = require('./boardEncoding')
const { outcomeValue } = require('./rewards')
const { tf } = require('./modelStore')

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function chooseMoveWithModel(model, chess, explorationRate) {
  const legalMoves = chess.moves({ verbose: true })

  if (!model || Math.random() < explorationRate) {
    return randomItem(legalMoves)
  }

  const state = encodeBoard(chess)
  const legalIndexes = legalMoves.map(moveToActionIndex)
  const scores = tf.tidy(() => {
    const input = tf.tensor2d([state])
    const [policy] = model.predict(input)

    return policy.dataSync()
  })

  let bestMove = legalMoves[0]
  let bestScore = -Infinity

  for (let index = 0; index < legalMoves.length; index += 1) {
    const score = scores[legalIndexes[index]]

    if (score > bestScore) {
      bestScore = score
      bestMove = legalMoves[index]
    }
  }

  return bestMove
}

function playSelfPlayGame(model, options = {}) {
  const chess = new Chess()
  const maxPlies = options.maxPlies || 400
  const explorationRate = options.explorationRate ?? 0.25
  const samples = []
  const moves = []

  while (!chess.isGameOver() && moves.length < maxPlies) {
    const color = chess.turn()
    const state = encodeBoard(chess)
    const move = chooseMoveWithModel(model, chess, explorationRate)

    chess.move(move)

    const moveRecord = {
      ply: moves.length + 1,
      moveNumber: Math.ceil((moves.length + 1) / 2),
      color: move.color === 'w' ? 'white' : 'black',
      san: move.san,
      uci: moveToUci(move),
      fen: chess.fen(),
    }

    moves.push(moveRecord)
    samples.push({
      state,
      action: moveToActionIndex(move),
      color,
      fen: moveRecord.fen,
    })
  }

  const hitMaxPlies = moves.length >= maxPlies && !chess.isGameOver()
  const game = {
    id: `game-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    initialFen: new Chess().fen(),
    currentFen: chess.fen(),
    result: chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : hitMaxPlies ? 'max plies' : 'in progress',
    hitMaxPlies,
    moves,
  }

  return {
    game,
    samples: samples.map((sample) => ({
      ...sample,
      value: outcomeValue(chess, sample.color, hitMaxPlies),
      gameId: game.id,
    })),
  }
}

function createLiveSelfPlayGame() {
  const chess = new Chess()

  return {
    id: `game-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    initialFen: chess.fen(),
    currentFen: chess.fen(),
    result: 'in progress',
    hitMaxPlies: false,
    moves: [],
    samples: [],
  }
}

function publicLiveGame(game) {
  if (!game) {
    return null
  }

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

function summarizeLiveGame(game) {
  if (!game) {
    return null
  }

  return {
    id: game.id,
    createdAt: game.createdAt,
    currentFen: game.currentFen,
    result: game.result,
    hitMaxPlies: game.hitMaxPlies,
    plyCount: game.moves.length,
  }
}

function advanceLiveSelfPlayGame(game, model, options = {}) {
  const maxPlies = options.maxPlies || 400
  const explorationRate = options.explorationRate ?? 0.25
  const chess = new Chess(game.currentFen || game.initialFen)

  if (chess.isGameOver() || game.moves.length >= maxPlies) {
    return finishLiveSelfPlayGame(game, chess, game.moves.length >= maxPlies && !chess.isGameOver())
  }

  const color = chess.turn()
  const state = encodeBoard(chess)
  const move = chooseMoveWithModel(model, chess, explorationRate)

  chess.move(move)

  const moveRecord = {
    ply: game.moves.length + 1,
    moveNumber: Math.ceil((game.moves.length + 1) / 2),
    color: move.color === 'w' ? 'white' : 'black',
    san: move.san,
    uci: moveToUci(move),
    fen: chess.fen(),
  }

  const nextGame = {
    ...game,
    currentFen: chess.fen(),
    result: chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : 'in progress',
    moves: [...game.moves, moveRecord],
    samples: [
      ...game.samples,
      {
        state,
        action: moveToActionIndex(move),
        color,
        fen: moveRecord.fen,
      },
    ],
  }

  if (chess.isGameOver() || nextGame.moves.length >= maxPlies) {
    return finishLiveSelfPlayGame(
      nextGame,
      chess,
      nextGame.moves.length >= maxPlies && !chess.isGameOver(),
    )
  }

  return {
    game: nextGame,
    completed: false,
    samples: [],
  }
}

function selectBestLegalMove(legalMoves, scores) {
  let bestMove = legalMoves[0]
  let bestScore = -Infinity

  for (const move of legalMoves) {
    const score = scores[moveToActionIndex(move)]

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove
}

function appendMoveToLiveGame(game, chess, state, color, move) {
  chess.move(move)

  const moveRecord = {
    ply: game.moves.length + 1,
    moveNumber: Math.ceil((game.moves.length + 1) / 2),
    color: move.color === 'w' ? 'white' : 'black',
    san: move.san,
    uci: moveToUci(move),
    fen: chess.fen(),
  }

  return {
    ...game,
    currentFen: chess.fen(),
    result: chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : 'in progress',
    moves: [...game.moves, moveRecord],
    samples: [
      ...game.samples,
      {
        state,
        action: moveToActionIndex(move),
        color,
        fen: moveRecord.fen,
      },
    ],
  }
}

function advanceLiveSelfPlayGames(games, model, options = {}) {
  const maxPlies = options.maxPlies || 400
  const explorationRate = options.explorationRate ?? 0.25
  const prepared = []
  const modelRows = []
  const results = Array(games.length).fill(null)

  for (let index = 0; index < games.length; index += 1) {
    const game = games[index]
    const chess = new Chess(game.currentFen || game.initialFen)

    if (chess.isGameOver() || game.moves.length >= maxPlies) {
      results[index] = finishLiveSelfPlayGame(game, chess, game.moves.length >= maxPlies && !chess.isGameOver())
      continue
    }

    const legalMoves = chess.moves({ verbose: true })
    const color = chess.turn()
    const state = encodeBoard(chess)
    const useRandom = !model || Math.random() < explorationRate

    prepared.push({
      index,
      game,
      chess,
      legalMoves,
      color,
      state,
      modelRow: useRandom ? -1 : modelRows.length,
    })

    if (!useRandom) {
      modelRows.push(state)
    }
  }

  const batchedScores = modelRows.length > 0
    ? tf.tidy(() => {
        const input = tf.tensor2d(modelRows)
        const [policy] = model.predict(input)

        return policy.arraySync()
      })
    : []

  for (const item of prepared) {
    const move = item.modelRow >= 0
      ? selectBestLegalMove(item.legalMoves, batchedScores[item.modelRow])
      : randomItem(item.legalMoves)
    const nextGame = appendMoveToLiveGame(item.game, item.chess, item.state, item.color, move)

    if (item.chess.isGameOver() || nextGame.moves.length >= maxPlies) {
      results[item.index] = finishLiveSelfPlayGame(
        nextGame,
        item.chess,
        nextGame.moves.length >= maxPlies && !item.chess.isGameOver(),
      )
    } else {
      results[item.index] = {
        game: nextGame,
        completed: false,
        samples: [],
      }
    }
  }

  return results
}

function finishLiveSelfPlayGame(game, chess, hitMaxPlies) {
  const finishedGame = {
    ...game,
    currentFen: chess.fen(),
    result: chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : hitMaxPlies ? 'max plies' : 'in progress',
    hitMaxPlies,
  }

  return {
    game: finishedGame,
    completed: true,
    samples: finishedGame.samples.map((sample) => ({
      ...sample,
      value: outcomeValue(chess, sample.color, hitMaxPlies),
      gameId: finishedGame.id,
    })),
  }
}

module.exports = {
  advanceLiveSelfPlayGame,
  advanceLiveSelfPlayGames,
  createLiveSelfPlayGame,
  playSelfPlayGame,
  publicLiveGame,
  summarizeLiveGame,
}
