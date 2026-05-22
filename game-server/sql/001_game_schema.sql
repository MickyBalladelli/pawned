CREATE TABLE IF NOT EXISTS game_characters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  zone_id VARCHAR(80) NOT NULL DEFAULT 'greenfields',
  level INTEGER NOT NULL DEFAULT 1,
  experience BIGINT NOT NULL DEFAULT 0,
  position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{}',
  skills JSONB NOT NULL DEFAULT '[]',
  inventory JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS game_world_state (
  id SERIAL PRIMARY KEY,
  zone_id VARCHAR(80) NOT NULL,
  shard_id VARCHAR(80) NOT NULL DEFAULT 'default',
  state JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(zone_id, shard_id)
);

CREATE INDEX IF NOT EXISTS idx_game_characters_user_id ON game_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_game_characters_zone_id ON game_characters(zone_id);
CREATE INDEX IF NOT EXISTS idx_game_world_state_zone_shard ON game_world_state(zone_id, shard_id);
