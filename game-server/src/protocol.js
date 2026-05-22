const MessageType = Object.freeze({
  HELLO: 'hello',
  SNAPSHOT: 'snapshot',
  INPUT: 'input',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
})

function parseMessage(rawMessage) {
  const text = Buffer.isBuffer(rawMessage) ? rawMessage.toString('utf8') : String(rawMessage)
  const payload = JSON.parse(text)

  if (!payload || typeof payload.type !== 'string') {
    throw new Error('Message type required')
  }

  return payload
}

function encodeMessage(payload) {
  return JSON.stringify(payload)
}

module.exports = {
  MessageType,
  parseMessage,
  encodeMessage,
}
