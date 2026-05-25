const os = require('os')
const path = require('path')
const { Worker } = require('worker_threads')

class TrainingWorkerPool {
  constructor(options = {}) {
    this.workerCount = options.workerCount || Math.max(1, Math.min(4, os.cpus().length - 1))
    this.parallelGames = options.parallelGames || 4
    this.workers = []
    this.latestGames = []
    this.nextId = 1
  }

  async start() {
    const baseCount = Math.floor(this.parallelGames / this.workerCount)
    const remainder = this.parallelGames % this.workerCount

    for (let index = 0; index < this.workerCount; index += 1) {
      const worker = new Worker(path.join(__dirname, 'trainingWorker.js'), {
        workerData: { workerId: index + 1 },
      })
      const wrapper = {
        worker,
        callbacks: new Map(),
      }

      worker.on('message', (message) => {
        const callback = wrapper.callbacks.get(message.id)

        if (!callback) {
          return
        }

        wrapper.callbacks.delete(message.id)
        callback.resolve(message)
      })
      worker.on('error', (err) => {
        for (const callback of wrapper.callbacks.values()) {
          callback.reject(err)
        }
        wrapper.callbacks.clear()
      })

      this.workers.push(wrapper)
      const initResult = await this.send(wrapper, {
        type: 'init',
        gameCount: baseCount + (index < remainder ? 1 : 0),
      })
      this.latestGames.push(...initResult.games)
    }
  }

  send(wrapper, message) {
    const id = this.nextId
    this.nextId += 1

    return new Promise((resolve, reject) => {
      wrapper.callbacks.set(id, { resolve, reject })
      wrapper.worker.postMessage({ ...message, id })
    })
  }

  async prepare(options) {
    const results = await Promise.all(this.workers.map((wrapper) => this.send(wrapper, {
      type: 'prepare',
      options,
    })))
    this.latestGames = results.flatMap((result) => result.games)
    return results
  }

  async apply(choicesByWorker, options) {
    const results = await Promise.all(this.workers.map((wrapper, index) => this.send(wrapper, {
      type: 'apply',
      choices: choicesByWorker[index] || [],
      options,
    })))
    this.latestGames = results.flatMap((result) => result.games)
    return results
  }

  async stop() {
    await Promise.all(this.workers.map((wrapper) => wrapper.worker.terminate()))
    this.workers = []
    this.latestGames = []
  }
}

module.exports = {
  TrainingWorkerPool,
}
