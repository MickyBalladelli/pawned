const hopByHopHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function getAllowedOrigins() {
  return String(process.env.PAWNED_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function setCorsHeaders(req, res) {
  const allowedOrigins = getAllowedOrigins()
  const requestOrigin = req.headers.origin

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Vary', 'Origin')
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization')
}

function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return Promise.resolve(undefined)
  }

  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
      return Promise.resolve(req.body)
    }

    return Promise.resolve(JSON.stringify(req.body))
  }

  return new Promise((resolve, reject) => {
    const chunks = []

    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function getForwardPath(req) {
  const url = new URL(req.url, `https://${req.headers.host || 'pawned.local'}`)
  let pathname = url.pathname

  if (pathname.startsWith('/api/socket.io/')) {
    pathname = pathname.slice('/api'.length)
  }

  return `${pathname}${url.search}`
}

function getForwardHeaders(req, targetUrl) {
  const headers = {}

  for (const [name, value] of Object.entries(req.headers)) {
    const lowerName = name.toLowerCase()

    if (hopByHopHeaders.has(lowerName) || lowerName === 'host') {
      continue
    }

    headers[name] = value
  }

  headers.host = targetUrl.host
  headers['x-forwarded-host'] = req.headers.host || ''
  headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'https'

  return headers
}

function writeJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function createProxyHandler(options = {}) {
  return async function proxyHandler(req, res) {
    setCorsHeaders(req, res)

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    const origin = normalizeOrigin(options.origin || process.env.PAWNED_API_ORIGIN)

    if (!origin) {
      writeJson(res, 500, { error: 'Missing PAWNED_API_ORIGIN' })
      return
    }

    try {
      const targetUrl = new URL(`${origin}${getForwardPath(req)}`)
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: getForwardHeaders(req, targetUrl),
        body: await readBody(req),
        redirect: 'manual'
      })

      res.statusCode = response.status

      response.headers.forEach((value, name) => {
        if (!hopByHopHeaders.has(name.toLowerCase())) {
          res.setHeader(name, value)
        }
      })

      const body = Buffer.from(await response.arrayBuffer())
      res.end(body)
    } catch (error) {
      writeJson(res, 502, {
        error: 'Backend unavailable',
        detail: process.env.NODE_ENV === 'production' ? undefined : error.message
      })
    }
  }
}

module.exports = {
  createProxyHandler
}
