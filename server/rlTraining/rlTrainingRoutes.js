const express = require('express')
const {
  getTrainingJob,
  startTrainingJob,
  stopTrainingJob,
} = require('./rlTrainingJobs')

function createRlTrainingRouter({ authenticate, requireAdmin }) {
  const router = express.Router()

  router.use(authenticate, requireAdmin)

  router.get('/job', (req, res) => {
    res.json({ job: getTrainingJob() })
  })

  router.post('/job', (req, res) => {
    const job = startTrainingJob(req.body, req.user)
    res.status(201).json({ job })
  })

  router.post('/job/stop', (req, res) => {
    const job = stopTrainingJob(req.user)
    res.json({ job })
  })

  return router
}

module.exports = createRlTrainingRouter
