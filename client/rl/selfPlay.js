import { Chess } from 'chess.js'
import { encodeBoardState, legalMovesAsUci } from './chessStateTensor.js'
import { finalRewards, rewardForPosition } from './rewards.js'

function applyUci(chess, uci) {
  return chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  })
}

function randomMove(legalMoves) {
  return legalMoves[Math.floor(Math.random() * legalMoves.length)]
}

export async function chooseSelfPlayMove(agent, chess, options = {}) {
  const legalMoves = legalMovesAsUci(chess)

  if (!legalMoves.length) {
    return null
  }

  if (!agent?.chooseMove) {
    return randomMove(legalMoves)
  }

  return agent.chooseMove({
    state: encodeBoardState(chess),
    fen: chess.fen(),
    legalMoves,
    temperature: options.temperature ?? 1,
  })
}

export async function playSelfPlayGame(agent, opponentAgent = agent, options = {}) {
  const chess = new Chess(options.startFen)
  const maxPlies = options.maxPlies ?? 240
  const trajectory = []

  while (!chess.isGameOver() && trajectory.length < maxPlies) {
    const color = chess.turn()
    const activeAgent = color === 'w' ? agent : opponentAgent
    const move = await chooseSelfPlayMove(activeAgent, chess, options)

    if (!move) {
      break
    }

    trajectory.push({
      fen: chess.fen(),
      color,
      state: encodeBoardState(chess),
      legalMoves: legalMovesAsUci(chess),
      move,
      rewardEstimate: rewardForPosition(chess, color, options.reward),
    })

    applyUci(chess, move)
  }

  const rewards = finalRewards(chess)

  return {
    pgn: chess.pgn(),
    finalFen: chess.fen(),
    result: chess.isDraw() ? 'draw' : chess.isCheckmate() ? 'checkmate' : 'maxPlies',
    rewards,
    samples: trajectory.map((sample) => ({
      ...sample,
      outcomeReward: rewards[sample.color],
    })),
  }
}

export async function generateSelfPlayBatch(agent, opponentAgent, options = {}) {
  const gameCount = options.gameCount ?? 16
  const games = []

  for (let index = 0; index < gameCount; index += 1) {
    games.push(await playSelfPlayGame(agent, opponentAgent, options))
  }

  return {
    games,
    samples: games.flatMap((game) => game.samples),
  }
}
