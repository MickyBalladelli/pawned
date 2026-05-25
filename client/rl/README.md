# Chess RL Architecture

## Board Tensor

Use shape `[8, 8, 18]`.

- Planes `0-11`: one-hot pieces, white then black: pawn, knight, bishop, rook, queen, king
- Plane `12`: side to move, `1` for white, `0` for black
- Planes `13-16`: castling rights: `K`, `Q`, `k`, `q`
- Plane `17`: en-passant target square

This is small, clear, and works with a CNN. Later, add repetition, halfmove clock, and move history planes if the agent needs memory.

## Self-Play Loop

1. Load current model as the learner.
2. Load a frozen previous checkpoint as the opponent.
3. Start a `chess.js` game.
4. Encode position with `encodeBoardState`.
5. Ask model for move policy.
6. Mask illegal moves using `chess.moves({ verbose: true })`.
7. Pick move with temperature noise during training.
8. Store `{ state, legalMoves, move, reward }`.
9. Finish game.
10. Backfill every move with final outcome reward.

## Reward

Main reward should be sparse and outcome based:

- Win: `+1`
- Loss: `-1`
- Draw: `0`

Small shaping can help early learning:

- Material balance: tiny weight like `0.05`
- Checkmate still dominates everything

Do not over-reward captures, checks, or queen moves. Agent may learn bad tricks.

## Pipeline

1. Generate games by self-play.
2. Convert games to training samples.
3. Train policy head to predict chosen good moves.
4. Train value head to predict final outcome.
5. Save checkpoint.
6. Keep older checkpoints.
7. Sample opponents from older checkpoints so the learner does not only beat itself today.

## Suggested Network

Use a CNN trunk over `[8, 8, 18]`.

- Policy head: scores all move actions, then mask illegal actions
- Value head: scalar `[-1, 1]` expected outcome

First simple version can let the model score legal UCI moves directly in JS. Stronger version should use a fixed AlphaZero-style action space.
