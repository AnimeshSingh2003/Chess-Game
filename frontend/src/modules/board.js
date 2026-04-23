/**
 * board.js — Chess board rendering & local game engine
 * Handles all DOM rendering for chess boards and local game logic (vs AI,
 * local pass-and-play, puzzles).  Uses chess.js for full rule enforcement.
 *
 * Each board is fully independent via a boardId key.
 * Online board rendering is delegated here too — moves are broadcast by
 * multiplayer.js before calling applyMoveToBoardUI().
 */

import { showToast } from './ui.js';
import { getUser } from './auth.js';

// Key: boardId → { engine: Chess, selectedSq: DOMElement|null, myColor: 'w'|'b'|null, timers: {...} }
const boards = {};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const PIECE_MAP = {
  p: 'black/pawn.png',   r: 'black/rook.png',   n: 'black/knight.png',
  b: 'black/bishop.png', q: 'black/queen.png',   k: 'black/king.png',
  P: 'white/pawn.png',   R: 'white/rook.png',    N: 'white/knight.png',
  B: 'white/bishop.png', Q: 'white/queen.png',   K: 'white/king.png',
};

// ── Asset path resolution (works when served from any base path) ─────────────

function assetUrl(rel) {
  const tag = document.querySelector('script[src*="app.js"], script[src*="app-bundle.js"]');
  if (!tag) return rel;
  try {
    return new URL(rel, new URL('.', tag.src)).href;
  } catch {
    return rel;
  }
}

// ── Board initialisation ─────────────────────────────────────────────────────

/**
 * Mount a new engine-backed chess board inside `containerId`.
 * @param {string} containerId  DOM id of the board container
 * @param {object} [opts]
 * @param {string}  [opts.fen]       FEN string to load (default: start)
 * @param {'w'|'b'|null} [opts.myColor]  Restrict interaction to one side
 * @param {boolean} [opts.flipped]   Render from black's perspective
 * @param {boolean} [opts.isometric] Render with CSS 3-D tilt
 */
export function initBoard(containerId, opts = {}) {
  if (typeof Chess !== 'function') {
    console.error('[board] chess.js not loaded');
    return;
  }

  const engine = opts.fen ? new Chess(opts.fen) : new Chess();
  boards[containerId] = {
    engine,
    selectedSq: null,
    myColor: opts.myColor ?? null,
    flipped: opts.flipped ?? false,
    isometric: opts.isometric ?? false,
    // Optional callback: (from, to, promotion) => void
    // Used by multiplayer to relay moves to server instead of applying locally.
    onMove: opts.onMove ?? null,
  };

  renderBoard(containerId);
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderBoard(containerId) {
  const state = boards[containerId];
  const container = document.getElementById(containerId);
  if (!state || !container) return;

  // Expose current turn as data attribute so AI loop & CSS can read it
  container.dataset.turn = state.engine.turn();

  container.innerHTML = '';

  const raw = state.engine.board(); // 8×8 array, row 0 = rank 8
  const rows = state.flipped ? [...raw].reverse().map(r => [...r].reverse()) : raw;

  rows.forEach((row, rIdx) => {
    row.forEach((cell, cIdx) => {
      // Map display index back to true board coordinates
      const trueR = state.flipped ? 7 - rIdx : rIdx;
      const trueC = state.flipped ? 7 - cIdx : cIdx;

      const sq = document.createElement('div');
      const isLight = (trueR + trueC) % 2 === 0;
      sq.className = `square ${isLight ? 'light' : 'dark'}`;
      sq.dataset.r = trueR;
      sq.dataset.c = trueC;

      if (cell) {
        const img = document.createElement('img');
        img.src = assetUrl(PIECE_MAP[cell.color === 'w' ? cell.type.toUpperCase() : cell.type]);
        img.alt = `${cell.color === 'w' ? 'White' : 'Black'} ${cell.type}`;
        img.className = `piece${state.isometric ? ' iso-piece' : ''}`;
        img.draggable = false;
        img.onerror = () => {
          img.style.display = 'none';
          sq.classList.add('piece-error');
        };
        sq.appendChild(img);
      }

      sq.addEventListener('click', () => _handleClick(containerId, sq, trueR, trueC));
      container.appendChild(sq);
    });
  });

  _highlightCheckedKing(containerId);
}

// ── Click handler ─────────────────────────────────────────────────────────────

function _handleClick(containerId, sq, r, c) {
  const state = boards[containerId];
  if (!state) return;

  const engine = state.engine;
  const square = _coords(r, c);

  // If a game is over, ignore clicks
  if (engine.isGameOver()) return;

  // Color guard: only let myColor interact
  if (state.myColor !== null) {
    const pieceAt = engine.get(square);
    if (state.selectedSq === null) {
      if (!pieceAt) return;
      if (pieceAt.color !== state.myColor) {
        showToast("That's not your piece.");
        return;
      }
    }
    if (engine.turn() !== state.myColor) {
      showToast("It's not your turn.");
      return;
    }
  }

  if (state.selectedSq === null) {
    // Select
    const piece = engine.get(square);
    if (!piece) return;
    if (state.myColor === null && piece.color !== engine.turn()) {
      showToast("Move the " + (engine.turn() === 'w' ? 'White' : 'Black') + " piece.");
      return;
    }
    state.selectedSq = square;
    _clearHighlights(containerId);
    sq.classList.add('selected');
    _showLegalDots(containerId, square);
  } else if (state.selectedSq === square) {
    // Deselect
    state.selectedSq = null;
    _clearHighlights(containerId);
  } else {
    // Attempt move
    const from = state.selectedSq;
    const to = square;
    const needsPromo = _isPromotion(engine, from, to);

    if (needsPromo) {
      _showPromotionPicker(containerId, from, to);
      return;
    }

    // If the board has an onMove relay (multiplayer), delegate instead of applying locally
    const st = boards[containerId];
    if (st && st.onMove) {
      st.selectedSq = null;
      _clearHighlights(containerId);
      st.onMove(from, to, 'q');
      return;
    }

    _applyMove(containerId, from, to);
  }
}

// ── Move application (local boards) ──────────────────────────────────────────

function _applyMove(containerId, from, to, promotion = 'q') {
  const state = boards[containerId];
  if (!state) return false;

  const move = state.engine.move({ from, to, promotion });
  if (!move) {
    showToast('Invalid move!');
    _clearHighlights(containerId);
    state.selectedSq = null;
    return false;
  }

  state.selectedSq = null;
  renderBoard(containerId);
  _highlightLastMove(containerId, from, to);
  _notifyStatus(containerId);
  return true;
}

/**
 * Called by multiplayer.js to instantly apply a move that was confirmed
 * by the server. No validation needed here — server already checked it.
 */
export function applyMoveToBoardUI(containerId, fenAfterMove, lastFrom, lastTo) {
  const state = boards[containerId];
  if (!state || typeof Chess !== 'function') return;

  state.engine = new Chess(fenAfterMove);
  state.selectedSq = null;
  renderBoard(containerId);
  _highlightLastMove(containerId, lastFrom, lastTo);
  _notifyStatus(containerId);
}

// ── Promotion picker ──────────────────────────────────────────────────────────

function _showPromotionPicker(containerId, from, to) {
  const existing = document.getElementById('promo-picker');
  if (existing) existing.remove();

  const state = boards[containerId];
  const color = state.engine.turn(); // 'w' or 'b'
  const pieces = ['q', 'r', 'b', 'n'];

  const picker = document.createElement('div');
  picker.id = 'promo-picker';
  picker.className = 'promo-picker glass-card';
  picker.innerHTML = '<p>Promote to:</p>';

  pieces.forEach(p => {
    const key = color === 'w' ? p.toUpperCase() : p;
    const btn = document.createElement('button');
    btn.className = 'promo-btn';
    const img = document.createElement('img');
    img.src = assetUrl(PIECE_MAP[key]);
    img.alt = key;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      picker.remove();
      _applyMove(containerId, from, to, p);
    });
    picker.appendChild(btn);
  });

  document.getElementById('app').appendChild(picker);
}

// ── AI moves ─────────────────────────────────────────────────────────────────

/**
 * Make a naive AI move for `containerId`.
 * Prioritises captures, then random legal moves.
 * A real Stockfish.js integration can replace this function later.
 */
export function makeAIMove(containerId) {
  const state = boards[containerId];
  if (!state) return;
  const engine = state.engine;
  if (engine.isGameOver()) return;

  const moves = engine.moves({ verbose: true });
  if (moves.length === 0) return;

  // Prefer captures
  const captures = moves.filter(m => m.captured);
  const pool = captures.length ? captures : moves;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  setTimeout(() => {
    const move = engine.move(chosen);
    if (move) {
      renderBoard(containerId);
      _highlightLastMove(containerId, chosen.from, chosen.to);
      _notifyStatus(containerId);
    }
  }, 400);
}

// ── Timers ────────────────────────────────────────────────────────────────────

const _timers = {}; // boardId → { white: ms, black: ms, interval: id, active: bool }

export function startTimer(boardId, whiteMs, blackMs) {
  stopTimer(boardId);
  _timers[boardId] = { white: whiteMs, black: blackMs, interval: null, active: true };
  _tickTimer(boardId);
}

export function stopTimer(boardId) {
  const t = _timers[boardId];
  if (t) {
    clearInterval(t.interval);
    t.active = false;
  }
}

function _tickTimer(boardId) {
  const t = _timers[boardId];
  if (!t) return;

  t.interval = setInterval(() => {
    const state = boards[boardId];
    if (!state || !t.active || state.engine.isGameOver()) {
      clearInterval(t.interval);
      return;
    }

    const turn = state.engine.turn();
    if (turn === 'w') t.white -= 1000; else t.black -= 1000;

    _renderTimers(boardId, t);

    if (t.white <= 0 || t.black <= 0) {
      clearInterval(t.interval);
      const loser = t.white <= 0 ? 'White' : 'Black';
      showToast(`${loser} ran out of time!`);
    }
  }, 1000);
}

function _renderTimers(boardId, t) {
  const fmt = ms => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selfs = document.querySelectorAll(`[data-timer-self="${boardId}"]`);
  const opps  = document.querySelectorAll(`[data-timer-opp="${boardId}"]`);

  // self = white unless flipped
  const state = boards[boardId];
  const selfIsWhite = !state || !state.flipped;
  selfs.forEach(el => { el.textContent = fmt(selfIsWhite ? t.white : t.black); });
  opps.forEach(el  => { el.textContent = fmt(selfIsWhite ? t.black : t.white); });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _coords(r, c) {
  return `${FILES[c]}${8 - r}`;
}

function _isPromotion(engine, from, to) {
  const piece = engine.get(from);
  if (!piece || piece.type !== 'p') return false;
  const toRank = Number.parseInt(to[1], 10);
  return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
}

function _clearHighlights(containerId) {
  document.querySelectorAll(`#${containerId} .square`).forEach(s => {
    s.classList.remove('selected', 'hint-dot', 'last-from', 'last-to');
  });
}

function _showLegalDots(containerId, square) {
  const state = boards[containerId];
  const moves = state.engine.moves({ square, verbose: true });
  const targets = new Set(moves.map(m => m.to));

  document.querySelectorAll(`#${containerId} .square`).forEach(s => {
    const sq = _coords(Number(s.dataset.r), Number(s.dataset.c));
    if (targets.has(sq)) s.classList.add('hint-dot');
  });
}

function _highlightLastMove(containerId, from, to) {
  document.querySelectorAll(`#${containerId} .square`).forEach(s => {
    const sq = _coords(Number(s.dataset.r), Number(s.dataset.c));
    if (sq === from) s.classList.add('last-from');
    if (sq === to)   s.classList.add('last-to');
  });
}

function _highlightCheckedKing(containerId) {
  const state = boards[containerId];
  if (!state || !state.engine.isCheck()) return;

  const engine = state.engine;
  const turn = engine.turn();

  // Find the king square
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = engine.get(_coords(r, c));
      if (p && p.type === 'k' && p.color === turn) {
        document.querySelectorAll(`#${containerId} .square`).forEach(s => {
          if (Number(s.dataset.r) === r && Number(s.dataset.c) === c) {
            s.classList.add('in-check');
          }
        });
        return;
      }
    }
  }
}

function _notifyStatus(containerId) {
  const state = boards[containerId];
  const engine = state.engine;

  if (engine.isCheckmate()) {
    const winner = engine.turn() === 'w' ? 'Black' : 'White';
    showToast(`Checkmate! ${winner} wins.`);
    stopTimer(containerId);
  } else if (engine.isStalemate()) {
    showToast('Draw — stalemate.');
    stopTimer(containerId);
  } else if (engine.isDraw()) {
    showToast('Draw.');
    stopTimer(containerId);
  } else if (engine.isCheck()) {
    showToast('Check!');
  }
}
