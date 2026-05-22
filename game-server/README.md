# Vela Game Server

Authoritative MMO server that lives beside the chat server.

## Shape

- `uWebSockets.js` transport for many WebSocket connections
- Fixed tick world loop, default `20 Hz`
- Zone model, ready for sharding by zone or shard id
- Postgres adapter pointed at the `vela` database by default
- Auth adapter stub, ready for shared JWT/game session tokens
- Game schema for characters and world state in `sql/001_game_schema.sql`

## Commands

```bash
npm install
npm start
```

Dev auth bypass:

```bash
GAME_AUTH_BYPASS=true npm start
```

## Endpoints

- `GET /health`
- `WS /play?token=...`

Client sends:

```json
{ "type": "input", "input": { "moveX": 1, "moveY": 0 } }
```

Server sends:

```json
{ "type": "snapshot", "tick": 1, "players": [], "monsters": [] }
```

## Scale Path

- Run many game-server processes
- Assign zones to processes
- Put Redis/NATS between processes for cross-zone handoff and global events
- Keep chat server separate
- Keep database writes batched and coarse; do not persist every tick
- Move CPU-heavy AI/pathfinding to worker threads or dedicated zone workers

