# Vela Godot Client

Godot 4 client for the Vela MMO game server.

## Run

Open this folder in Godot:

```text
godot-client/
```

Press Play.

## Controls

- `WASD` moves the humanoid character

## Server

The client tries to connect to:

```text
ws://127.0.0.1:4100/play
```

If the game server is not running, movement still works locally.

For auth later, set:

```bash
VELA_GAME_TOKEN=your-token
```

The client sends movement input:

```json
{ "type": "input", "input": { "moveX": 1, "moveY": 0 } }
```
