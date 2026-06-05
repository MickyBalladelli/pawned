# Deployment

## Vercel client + serverless proxy

Vercel builds the Vite client from `client/` and serves `client/dist`.

Set this Vercel environment variable:

```sh
PAWNED_API_ORIGIN=https://your-node-backend.example.com
```

The serverless function in `api/[...path].js` forwards `/api/*` requests to that backend. This keeps browser API calls same-origin.

For live Socket.IO, set:

```sh
VITE_SOCKET_ORIGIN=https://your-node-backend.example.com
```

`VITE_API_ORIGIN` is optional. Leave it empty on Vercel when using the serverless proxy. Set it only when the client should call an API origin directly.

## Other serverless hosts

Reuse `serverless/proxyHandler.js` from any Node serverless adapter:

```js
const { createProxyHandler } = require('./serverless/proxyHandler')

module.exports = createProxyHandler({
  origin: process.env.PAWNED_API_ORIGIN
})
```
