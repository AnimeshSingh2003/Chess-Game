import { Chess } from 'chess.js';

// Accepts either SAN or UCI notation and returns a normalized UCI string
export function resolveExpectedUci(fen, bestMove) {
  if (!bestMove || !fen) return null;
  const clean = bestMove.trim();
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(clean)) return clean.toLowerCase();
  try {
    const ch = new Chess(fen);
    const mv = ch.move(clean.replace(/[+#!?]/g, ''));
    if (!mv) return null;
    return mv.from + mv.to + (mv.promotion || '');
  } catch { return null; }
}
