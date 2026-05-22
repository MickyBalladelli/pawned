class PlayerSession {
  constructor({ socket, user, zoneId }) {
    this.socket = socket
    this.user = user
    this.zoneId = zoneId
    this.entityId = `player:${user.id}:${Date.now()}`
    this.lastInput = null
    this.position = { x: 0, y: 0 }
    this.velocity = { x: 0, y: 0 }
  }

  setInput(input) {
    this.lastInput = input

    const speed = 5
    this.velocity = {
      x: Math.max(-1, Math.min(1, Number(input?.moveX) || 0)) * speed,
      y: Math.max(-1, Math.min(1, Number(input?.moveY) || 0)) * speed,
    }
  }

  update(deltaSeconds) {
    this.position.x += this.velocity.x * deltaSeconds
    this.position.y += this.velocity.y * deltaSeconds
  }

  toSnapshot() {
    return {
      id: this.entityId,
      userId: this.user.id,
      username: this.user.username,
      x: Number(this.position.x.toFixed(3)),
      y: Number(this.position.y.toFixed(3)),
    }
  }
}

module.exports = PlayerSession
