# Chess RL Agent Plan

Done now:

1. Generate self-play games with `chess.js`.
2. Encode board states as tensors.
3. Train a TensorFlow.js policy/value model.
4. Store games in `server/rlTraining/data/games.jsonl`.
5. Store samples in `server/rlTraining/data/samples.jsonl`.
6. Save checkpoints in `server/rlTraining/checkpoints/`.
7. Show latest self-play game, moves, loss, samples, and checkpoint in admin UI.
8. Stop training when auth fails.
9. Generate multiple live self-play games in parallel with configurable `parallelGames`.
10. Run training in a separate local trainer server behind app-server admin proxy.
11. Batch policy inference across active games.
12. Send compact active-game summaries to UI and full moves only for selected game.

Runtime persistence:

- Browser refresh: training continues.
- Log out or auth failure: training stops.
- Trainer restart, Node crash, or deploy restart: active job is lost.
- App server restart does not stop trainer if trainer process keeps running.
- Generated games, samples, and checkpoints remain on disk.
- Active job state is kept in trainer memory only.

Training terms:

- Iterations: number of train cycles to run.
- Games / iteration: completed self-play games collected before one train step.
- Checkpoint every: save model every N iterations.
- Max plies: hard game length cap. One ply is one half-move.
- Ply delay (ms): delay between live generation ticks. Lower means faster.
- Parallel games: number of self-play games generated at the same time. Current cap is `256`.
- Train samples: maximum move samples used in one train step.
- Train batch: TensorFlow batch size used inside one train step.
- Game: one self-play chess game.
- Sample: one training row from one position. It stores board state, chosen move, and final reward.
- Loss: current model training error. Lower usually better, but not perfect proof.
- Checkpoint: saved model weights for later use or rollback.
- Active games: live self-play games currently generating.
- Total games: completed games saved to disk during current job.
- Total samples: move samples saved to disk during current job.

Still needed for strong play:

1. Replace random exploration with MCTS.
2. Load best checkpoint on server start.
3. Evaluate new checkpoints against old checkpoints before promotion.
4. Add checkpoint browser and delete/export controls.
5. Add worker thread/process pool inside trainer for CPU-heavy scaling.
6. Persist and restore active job state after trainer restart.
7. Move storage to compact binary format if JSONL becomes bottleneck.
