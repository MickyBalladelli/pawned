# Vela Unreal Client

Unreal client for the Vela MMO game server.

## Shape

- C++ project, no locked-in Blueprint-only path
- WebSocket connection to `ws://127.0.0.1:4100/play`
- Sends movement input to the existing game server
- Default pawn is `AVelaHeroCharacter`
- Network layer lives in `UVelaGameInstance`
- Rendering settings start with Lumen-ready defaults

## Start

1. Open `VelaUnrealClient.uproject` in Unreal Engine 5
2. Let Unreal generate project files
3. Build the project
4. Press Play

Start the game server first:

```bash
cd /Users/micky/dev/vela/game-server
GAME_AUTH_BYPASS=true npm start
```

## Controls

- `WASD` move
- Mouse look

## Server URL

Default:

```text
ws://127.0.0.1:4100/play
```

Override at launch:

```bash
-VelaServer=ws://127.0.0.1:4100/play
```

## Future Path

- Replace default capsule with MetaHuman or custom hero mesh
- Move input to Enhanced Input assets
- Add prediction and reconciliation
- Add replicated remote players from server snapshots
- Add Gameplay Ability System for skills
- Add MassEntity for crowds and monsters
- Add world partition and streaming maps
