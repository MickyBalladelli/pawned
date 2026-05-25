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

Still needed for strong play:

1. Replace random exploration with MCTS.
2. Load best checkpoint on server start.
3. Evaluate new checkpoints against old checkpoints before promotion.
4. Add checkpoint browser and delete/export controls.
5. Run training in worker thread or separate process for heavy jobs.
6. Add `@tensorflow/tfjs-node` when native install is acceptable.
