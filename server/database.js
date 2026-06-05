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

  return new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/pawned'
  })
}

module.exports = {
  createDatabasePool
}
