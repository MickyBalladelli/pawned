function numberFromEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

const config = {
  port: numberFromEnv('GAME_PORT', 4100),
  tickRate: numberFromEnv('GAME_TICK_RATE', 20),
  maxPayloadBytes: numberFromEnv('GAME_MAX_PAYLOAD_BYTES', 16 * 1024),
  idleTimeoutSeconds: numberFromEnv('GAME_IDLE_TIMEOUT_SECONDS', 60),
  authBypass: process.env.GAME_AUTH_BYPASS === 'true',
  database: {
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'vela',
    password: process.env.PGPASSWORD || 'postgres',
    port: numberFromEnv('PGPORT', 5432),
  },
}

module.exports = config
