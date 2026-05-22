const { Pool } = require('pg')
const config = require('./config')

const pool = new Pool(config.database)

async function closeDatabase() {
  await pool.end()
}

module.exports = {
  pool,
  closeDatabase,
}
