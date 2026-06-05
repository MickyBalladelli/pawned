const { createProxyHandler } = require('../serverless/proxyHandler')

if (process.env.PAWNED_API_ORIGIN) {
  module.exports = createProxyHandler()
} else {
  const { app } = require('../server/server')

  module.exports = app
}
