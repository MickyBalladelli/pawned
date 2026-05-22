const config = require('./config')
const { pool, closeDatabase } = require('./db')
const AuthService = require('./auth/AuthService')
const UwsTransport = require('./net/UwsTransport')
const WorldServer = require('./world/WorldServer')

async function main() {
  await pool.query('SELECT 1')

  const world = new WorldServer({ tickRate: config.tickRate })
  const authService = new AuthService({ pool, authBypass: config.authBypass })
  const transport = new UwsTransport({ authService, world, config })

  world.start()
  transport.listen()

  process.on('SIGINT', async () => {
    world.stop()
    await closeDatabase()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    world.stop()
    await closeDatabase()
    process.exit(0)
  })
}

main().catch(async (err) => {
  console.error('Game server crashed during startup:', err)
  await closeDatabase().catch(() => {})
  process.exit(1)
})
