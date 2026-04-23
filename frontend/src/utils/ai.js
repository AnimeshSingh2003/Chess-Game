// Minimax AI with alpha-beta pruning

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

export function evaluateBoard(engine) {
  let score = 0;
  for (const row of engine.board()) {
    for (const p of row) {
      if (!p) continue;
      score += (p.color === 'w' ? 1 : -1) * PIECE_VALUES[p.type];
    }
  }
  return score;
}

export function minimax(engine, depth, alpha, beta, maximizing) {
  if (depth === 0 || engine.isGameOver()) return { score: evaluateBoard(engine) };
  const moves = engine.moves({ verbose: true });
  let bestMove = null;
  if (maximizing) {
    let maxScore = -Infinity;
    for (const move of moves) {
      engine.move(move);
      const { score } = minimax(engine, depth - 1, alpha, beta, false);
      engine.undo();
      if (score > maxScore) { maxScore = score; bestMove = move; }
      alpha = Math.max(alpha, maxScore);
      if (beta <= alpha) break;
    }
    return { score: maxScore, move: bestMove };
  }
  let minScore = Infinity;
  for (const move of moves) {
    engine.move(move);
    const { score } = minimax(engine, depth - 1, alpha, beta, true);
    engine.undo();
    if (score < minScore) { minScore = score; bestMove = move; }
    beta = Math.min(beta, minScore);
    if (beta <= alpha) break;
  }
  return { score: minScore, move: bestMove };
}
