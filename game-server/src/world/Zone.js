const { MessageType, encodeMessage } = require('../protocol')

class Zone {
  constructor({ id }) {
    this.id = id
    this.players = new Map()
    this.monsters = new Map()
  }

  addPlayer(session) {
    this.players.set(session.entityId, session)
    this.broadcastSystem(`${session.user.username} entered the zone`)
  }

  removePlayer(session) {
    this.players.delete(session.entityId)
    this.broadcastSystem(`${session.user.username} left the zone`)
  }

  update(deltaSeconds) {
    for (const player of this.players.values()) {
      player.update(deltaSeconds)
    }
  }

  broadcastSnapshot(tick) {
    const message = encodeMessage({
      type: MessageType.SNAPSHOT,
      zoneId: this.id,
      tick,
      players: [...this.players.values()].map((player) => player.toSnapshot()),
      monsters: [...this.monsters.values()],
    })

    this.broadcast(message)
  }

  broadcastSystem(text) {
    this.broadcast(encodeMessage({
      type: 'system',
      zoneId: this.id,
      text,
      createdAt: new Date().toISOString(),
    }))
  }

  broadcast(message) {
    for (const player of this.players.values()) {
      player.socket.send(message)
    }
  }
}

module.exports = Zone
