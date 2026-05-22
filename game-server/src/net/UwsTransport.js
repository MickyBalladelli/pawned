const uWS = require('uWebSockets.js')
const crypto = require('crypto')
const { MessageType, parseMessage, encodeMessage } = require('../protocol')

function getToken(req) {
  const tokenQuery = req.getQuery('token')

  if (tokenQuery) {
    return tokenQuery
  }

  const protocol = req.getHeader('sec-websocket-protocol') || ''
  return protocol.split(',').map((item) => item.trim()).find(Boolean) || ''
}

class UwsTransport {
  constructor({ authService, world, config }) {
    this.authService = authService
    this.world = world
    this.config = config
    this.app = uWS.App()
  }

  listen() {
    this.app.get('/health', (res) => {
      res.writeHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        ok: true,
        stats: this.world.getStats(),
      }))
    })

    this.app.ws('/play', {
      compression: uWS.SHARED_COMPRESSOR,
      maxPayloadLength: this.config.maxPayloadBytes,
      idleTimeout: this.config.idleTimeoutSeconds,
      upgrade: async (res, req, context) => {
        res.onAborted(() => {
          res.aborted = true
        })

        const token = getToken(req)
        const user = await this.authService.verifyToken(token)

        if (!user || res.aborted) {
          if (!res.aborted) {
            res.writeStatus('401 Unauthorized').end('Authentication required')
          }
          return
        }

        res.upgrade(
          { id: crypto.randomUUID(), user },
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context,
        )
      },
      open: (socket) => {
        console.log('Game client connected:', {
          socketId: socket.id,
          userId: socket.user?.id,
          username: socket.user?.username,
        })
        this.world.addConnection(socket, socket.user)
      },
      message: (socket, rawMessage) => {
        try {
          const message = parseMessage(Buffer.from(rawMessage))

          if (message.type === MessageType.INPUT) {
            console.log('Game input received:', {
              socketId: socket.id,
              userId: socket.user?.id,
              input: message.input,
            })
            this.world.handleInput(socket, message.input)
            return
          }

          if (message.type === MessageType.PING) {
            socket.send(encodeMessage({ type: MessageType.PONG, at: Date.now() }))
          }
        } catch (err) {
          console.error('Game message failed:', {
            socketId: socket.id,
            error: err.message,
            rawMessage: Buffer.from(rawMessage).toString('utf8'),
          })
          socket.send(encodeMessage({ type: MessageType.ERROR, error: err.message }))
        }
      },
      close: (socket) => {
        console.log('Game client disconnected:', {
          socketId: socket.id,
          userId: socket.user?.id,
        })
        this.world.removeConnection(socket)
      },
    })

    this.app.listen(this.config.port, (token) => {
      if (!token) {
        console.error(`Game server failed to listen on port ${this.config.port}`)
        process.exitCode = 1
        return
      }

      console.log(`Vela game server listening on ${this.config.port}`)
    })
  }
}

module.exports = UwsTransport
