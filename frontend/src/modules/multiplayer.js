/**
 * multiplayer.js — Socket.IO client for real-time room-based chess
 * Handles connection lifecycle, room creation/joining, move relay,
 * and reconnection. Game rules are enforced server-side.
 */

import { showToast } from './ui.js';
import { getUsername } from './auth.js';
import { initBoard, applyMoveToBoardUI } from './board.js';
import { nav } from './router.js';

// Vite env takes priority; window override remains for static hosting fallback.
const SERVER_URL = import.meta.env?.VITE_SERVER_URL || globalThis.ARCHESS_SERVER_URL || 'http://localhost:3001';
const BOARD_ID = 'online-chessboard';

let socket = null;
let _myColor = null;
let _roomCode = null;

// ── Public API ────────────────────────────────────────────────────────────────

export function openRoomModal() {
  document.getElementById('room-modal').classList.remove('hidden');
}

export function closeRoomModal() {
  document.getElementById('room-modal').classList.add('hidden');
  const inp = document.getElementById('join-room-input');
  if (inp) inp.value = '';
}

export function createRoom() {
  _ensureConnected();
  if (!socket) return;

  socket.emit('room:create', { username: getUsername() }, (res) => {
    if (!res?.ok) {
      showToast(res?.error || 'Could not create room.');
      return;
    }
    _onRoomJoined(res.room, res.color);
    _updateRoomUI(res.room);
    showToast(`Room ready: ${res.room.code} — share it!`);
  });
}

export function joinRoomFromInput() {
  const inp = document.getElementById('join-room-input');
  if (!inp) return;

  const code = inp.value.trim().toUpperCase().replaceAll(/[^A-Z0-9]/g, '');
  if (code.length < 4) {
    showToast('Enter a valid room code.');
    return;
  }

  _ensureConnected();
  if (!socket) return;

  socket.emit('room:join', { code, username: getUsername() }, (res) => {
    if (!res?.ok) {
      showToast(res?.error || 'Could not join room.');
      return;
    }
    _onRoomJoined(res.room, res.color);
    _updateRoomUI(res.room);
    showToast(`Joined room ${res.room.code} as ${res.color}`);
  });
}

export function sendMove(from, to, promotion = 'q') {
  if (!socket?.connected) {
    showToast('Not connected to server.');
    return;
  }
  socket.emit('game:move', { from, to, promotion }, (res) => {
    if (!res?.ok) {
      showToast(res?.error || 'Invalid move.');
    }
  });
}

export function copyRoomCode() {
  if (!_roomCode) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(_roomCode)
      .then(() => showToast(`Code ${_roomCode} copied!`))
      .catch(() => showToast(`Room: ${_roomCode}`));
  } else {
    showToast(`Room: ${_roomCode}`);
  }
}

export function leaveGame() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  _myColor = null;
  _roomCode = null;
  nav('home');
  showToast('Left the game.');
}

export function myColor() { return _myColor; }

// ── Connection ────────────────────────────────────────────────────────────────

function _ensureConnected() {
  if (socket?.connected) return;

  if (typeof io !== 'function') {
    showToast('Multiplayer unavailable — server not reachable.');
    return;
  }

  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 4,
    timeout: 6000,
  });

  socket.on('connect', () => showToast('Connected to server.'));
  socket.on('connect_error', () => showToast('Server unreachable. Check connection.'));
  socket.on('disconnect', () => {
    showToast('Disconnected. Reconnecting…');
  });

  socket.on('room:update', (state) => _handleRoomUpdate(state));
  socket.on('game:update', ({ state, move }) => _handleGameUpdate(state, move));
}

// ── Room helpers ──────────────────────────────────────────────────────────────

function _onRoomJoined(room, color) {
  _myColor = color;
  _roomCode = room.code;

  closeRoomModal();

  // Flip the board if playing as black
  initBoard(BOARD_ID, {
    fen: room.fen,
    myColor: color === 'white' ? 'w' : 'b',
    flipped: color === 'black',
    onMove: (from, to, promotion) => sendMove(from, to, promotion),
  });

  nav('online-game');
}

function _handleRoomUpdate(state) {
  _updateRoomUI(state);
  // Sync board with latest FEN (opponent joined / reconnected)
  if (typeof Chess === 'function') {
    initBoard(BOARD_ID, {
      fen: state.fen,
      myColor: _myColor === 'white' ? 'w' : 'b',
      flipped: _myColor === 'black',
      onMove: (from, to, promotion) => sendMove(from, to, promotion),
    });
  }
}

function _handleGameUpdate(state, move) {
  applyMoveToBoardUI(BOARD_ID, state.fen, move.from, move.to);
  _updateTurnUI(state);

  if (state.isCheckmate) {
    const winner = state.turn === 'w' ? 'Black' : 'White';
    showToast(`Checkmate! ${winner} wins.`);
  } else if (state.isStalemate) {
    showToast('Draw — stalemate.');
  } else if (state.isDraw) {
    showToast('Draw.');
  } else if (state.isCheck) {
    showToast('Check!');
  }
}

function _updateRoomUI(state) {
  const codeEl = document.getElementById('online-room-code');
  if (codeEl) codeEl.textContent = state.code;

  const oppKey = _myColor === 'white' ? 'black' : 'white';
  const opp = state.players?.[oppKey];
  const oppNameEl = document.getElementById('online-opponent-name');
  if (oppNameEl) oppNameEl.textContent = opp ? opp.username : 'Waiting for opponent…';

  const colorEl = document.getElementById('online-my-color');
  if (colorEl) colorEl.textContent = _myColor === 'white' ? 'Playing as White' : 'Playing as Black';

  _updateTurnUI(state);
}

function _updateTurnUI(state) {
  const turnEl = document.getElementById('online-turn-indicator');
  if (!turnEl) return;

  const myTurn = (state.turn === 'w' && _myColor === 'white') ||
                 (state.turn === 'b' && _myColor === 'black');
  turnEl.textContent = myTurn ? 'Your turn' : "Opponent's turn";
  turnEl.className = myTurn ? 'turn-mine' : 'turn-opp';
}
