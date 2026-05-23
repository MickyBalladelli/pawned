# Vela Unity Client

Unity 3D client for the Vela MMO game server.

## Run

Open this folder in Unity Hub:

```text
unity-client/
```

Press Play. The world builds itself from `Assets/Scripts/VelaBootstrap.cs`.

## Controls

- `WASD` moves the character
- Left click moves to ground
- Hold left mouse and drag keeps updating the move target
- Right click turns the character toward the ground point
- Mouse wheel zooms camera
- Hold right mouse and move up/down to zoom camera

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
