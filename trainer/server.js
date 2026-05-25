const http = require('http')
const {
  getTrainingJob,
  startTrainingJob,
  stopAllTrainingJobs,
  stopTrainingJob,
} = require('../server/rlTraining/rlTrainingJobs')

const host = process.env.TRAINER_HOST || '127.0.0.1'
const port = Number(process.env.TRAINER_PORT || 6060)

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''

    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      if (!data) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(data))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function getProxyUser(req) {
  const header = req.headers['x-vela-user']

  if (!header) {
    return { id: null, username: 'trainer' }
  }

  try {
    return JSON.parse(decodeURIComponent(header))
  } catch {
    return { id: null, username: 'trainer' }
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'GET' && url.pathname === '/job') {
      sendJson(res, 200, { job: getTrainingJob({ selectedGameId: url.searchParams.get('selectedGameId') }) })
      return
    }

    if (req.method === 'POST' && url.pathname === '/job') {
      const body = await readJsonBody(req)
      const job = startTrainingJob(body, getProxyUser(req))

      sendJson(res, 201, { job })
      return
    }

    if (req.method === 'POST' && url.pathname === '/job/stop') {
      const job = stopTrainingJob(getProxyUser(req))

      sendJson(res, 200, { job })
      return
    }

    if (req.method === 'POST' && url.pathname === '/job/stop-all') {
      const body = await readJsonBody(req)
      const job = stopAllTrainingJobs(body.message || 'Stopped')

      sendJson(res, 200, { job })
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error('Trainer request failed:', err)
    sendJson(res, 500, { error: 'Trainer request failed' })
  }
}

const server = http.createServer(handleRequest)

server.listen(port, host, () => {
  console.log(`Vela trainer running on http://${host}:${port}`)
})
