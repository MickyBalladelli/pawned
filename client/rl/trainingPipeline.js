import { generateSelfPlayBatch } from './selfPlay.js'

export async function runTrainingPipeline(config) {
  const {
    agent,
    createOpponent,
    trainOnSamples,
    saveModel,
    iterations = 100,
    gamesPerIteration = 32,
    checkpointEvery = 10,
  } = config

  const history = []

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const opponent = await createOpponent(agent, iteration)
    const batch = await generateSelfPlayBatch(agent, opponent, {
      gameCount: gamesPerIteration,
      temperature: Math.max(0.1, 1 - iteration / iterations),
      reward: config.reward,
    })

    const metrics = await trainOnSamples(agent, batch.samples, {
      iteration,
      games: batch.games,
    })

    history.push({
      iteration,
      games: batch.games.length,
      samples: batch.samples.length,
      metrics,
    })

    if (iteration % checkpointEvery === 0) {
      await saveModel(agent, {
        iteration,
        history,
      })
    }
  }

  return history
}
