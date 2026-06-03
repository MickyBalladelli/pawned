const thinkingByGameId = new Map()

function setBotThinking(update) {
  const gameId = Number(update.gameId)

  if (!update.thinking) {
    thinkingByGameId.delete(gameId)
    return null
  }

  const next = {
    gameId,
    thinking: true,
    bestMove: update.bestMove || thinkingByGameId.get(gameId)?.bestMove || null,
  }

  thinkingByGameId.set(gameId, next)
  return next
}

function getBotThinking(gameId) {
  return thinkingByGameId.get(Number(gameId)) || null
}

module.exports = {
  getBotThinking,
  setBotThinking,
}
