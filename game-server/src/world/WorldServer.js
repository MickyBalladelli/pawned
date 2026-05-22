const PlayerSession = require('./PlayerSession')
const Zone = require('./Zone')
const { MessageType, encodeMessage } = require('../protocol')

class WorldServer {
  constructor({ tickRate }) {
    this.tickRate = tickRate
    this.tickMs = Math.floor(1000 / tickRate)
    this.tick = 0
    this.sessions = new Map()
    this.zones = new Map()
    this.timer = null
    this.lastTickAt = Date.now()
  }

  start() {
    if (this.timer) {
      return
    }

    this.lastTickAt = Date.now()
    this.timer = setInterval(() => this.update(), this.tickMs)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  addConnection(socket, user, zoneId = 'greenfields') {
    const zone = this.getZone(zoneId)
    const session = new PlayerSession({ socket, user, zoneId })

    this.sessions.set(socket.id, session)
    zone.addPlayer(session)

    socket.send(encodeMessage({
      type: MessageType.HELLO,
      playerId: session.entityId,
      zoneId,
      tickRate: this.tickRate,
    }))

    return session
  }

  removeConnection(socket) {
    const session = this.sessions.get(socket.id)

    if (!session) {
      return
    }

    this.sessions.delete(socket.id)
    this.getZone(session.zoneId).removePlayer(session)
  }

  handleInput(socket, input) {
    const session = this.sessions.get(socket.id)

    if (session) {
      session.setInput(input)
    }
  }

  getZone(id) {
    if (!this.zones.has(id)) {
      this.zones.set(id, new Zone({ id }))
    }

    return this.zones.get(id)
  }

  update() {
    const now = Date.now()
    const deltaSeconds = Math.min((now - this.lastTickAt) / 1000, 0.25)
    this.lastTickAt = now
    this.tick += 1

    for (const zone of this.zones.values()) {
      zone.update(deltaSeconds)
      zone.broadcastSnapshot(this.tick)
    }
  }

  getStats() {
    return {
      tick: this.tick,
      tickRate: this.tickRate,
      connections: this.sessions.size,
      zones: this.zones.size,
    }
  }
}

module.exports = WorldServer
