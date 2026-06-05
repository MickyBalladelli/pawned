const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

function loadLocalEnv() {
  const envPath = path.resolve(__dirname, '..', '.env')

  if (!fs.existsSync(envPath)) {
    return
  }

  const envText = fs.readFileSync(envPath, 'utf8')

  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)

    if (!match || process.env[match[1]] !== undefined) {
      continue
    }

    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

function createDatabasePool() {
  loadLocalEnv()
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/pawned'
  const useSsl = connectionString.includes('sslmode=require')
  let poolConnectionString = connectionString

  if (useSsl) {
    const databaseUrl = new URL(connectionString)
    databaseUrl.searchParams.delete('sslmode')
    poolConnectionString = databaseUrl.toString()
  }

  return new Pool({
    connectionString: poolConnectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined
  })
}

module.exports = {
  createDatabasePool
}
