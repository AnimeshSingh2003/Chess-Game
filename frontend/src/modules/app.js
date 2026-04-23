/**
 * app.js — Application entry point
 * Wires all modules together, registers screen lifecycle hooks,
 * and boots the app on DOMContentLoaded.
 *
 * Nothing game-specific lives here — each concern is in its own module.
 */

import { nav, onEnter, onLeave } from './router.js';
import { restoreSession, promptUsername, cancelUsernamePrompt,
         submitUsername, logout, openAvatarModal, closeAvatarModal,
         selectAvatar, handleAvatarUpload } from './auth.js';
import { showToast, initThemeControls, initTabs, spawnParticles } from './ui.js';
import { initBoard, makeAIMove, startTimer, stopTimer } from './board.js';
import { openRoomModal, closeRoomModal, createRoom,
         joinRoomFromInput, sendMove, copyRoomCode,
         leaveGame, myColor } from './multiplayer.js';

// Expose to inline HTML onclick until we move fully off inline handlers
window.app = {
  nav, showToast,
  promptUsername, cancelUsernamePrompt, submitUsername, logout,
  openAvatarModal, closeAvatarModal, selectAvatar, handleAvatarUpload,
  openRoomModal, closeRoomModal, createRoom, joinRoomFromInput,
  copyRoomCode, leaveGame,

  // AR (screen-level — see onEnter hook below)
  scanSurface, placeARBoard, resetAR, toggleARAnalysis,
};

// ── Screen lifecycle ──────────────────────────────────────────────────────────

onEnter('standard-game', () => {
  initBoard('standard-chessboard', { myColor: null }); // local pass-and-play
  const mins = _selectedMinutes();
  if (mins) startTimer('standard-chessboard', mins * 60000, mins * 60000);
});
onLeave('standard-game', () => stopTimer('standard-chessboard'));

onEnter('ai-game', () => {
  initBoard('ai-chessboard', { myColor: 'w' });
  _aiLoop('ai-chessboard');
});
onLeave('ai-game', () => stopTimer('ai-chessboard'));

onEnter('puzzles', () => {
  initBoard('puzzle-chessboard', {
    fen: 'r5k1/pp3pbp/2p3p1/4p3/3P4/2N2Q2/PPP2PPP/R1B2RK1 w - - 0 1',
    myColor: 'w',
  });
});

onEnter('ar-mode', () => resetAR());

onEnter('home', () => {
  // Lightweight isometric preview in home (non-interactive)
  initBoard('home-preview-board', { isometric: true });
});

// ── AI game loop ──────────────────────────────────────────────────────────────

function _aiLoop(boardId) {
  // After each render, if it's the AI's turn (black), make a move
  const observer = new MutationObserver(() => {
    const container = document.getElementById(boardId);
    if (!container) return;
    // Check whose turn it is via data attribute we set during render
    const turnAttr = container.dataset.turn;
    if (turnAttr === 'b') makeAIMove(boardId);
  });

  const el = document.getElementById(boardId);
  if (el) observer.observe(el, { childList: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _selectedMinutes() {
  // Read from wherever the modes screen stores the chosen time control
  const mins = sessionStorage.getItem('archess_tc_mins');
  return mins ? Number.parseInt(mins, 10) : 0;
}

// ── AR screen (simple simulation with real camera request) ────────────────────

let _arStream = null;

async function _requestCamera() {
  try {
    _arStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const feed = document.getElementById('ar-camera-feed');
    if (feed) {
      feed.innerHTML = '';
      const video = document.createElement('video');
      video.srcObject = _arStream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
      feed.appendChild(video);
    }
    return true;
  } catch {
    return false;
  }
}

function _stopCamera() {
  if (_arStream) {
    _arStream.getTracks().forEach(t => t.stop());
    _arStream = null;
  }
  const feed = document.getElementById('ar-camera-feed');
  if (feed) feed.innerHTML = '<div class="ar-grid-overlay"></div>';
}

function resetAR() {
  const reticle = document.querySelector('.scanning-reticle');
  const board3d = document.getElementById('ar-3d-board');
  const placeBtn = document.getElementById('btn-place-board');
  const scanText = document.querySelector('.scanning-reticle .scan-text');

  if (reticle) reticle.classList.remove('hidden');
  if (board3d) board3d.classList.add('hidden');
  if (placeBtn) placeBtn.disabled = true;
  if (scanText) { scanText.textContent = 'Point camera at a flat surface…'; scanText.className = 'scan-text'; }

  const popup = document.getElementById('ar-analysis-popup');
  if (popup) popup.classList.add('hidden');
}

async function scanSurface() {
  showToast('Requesting camera…');
  const granted = await _requestCamera();

  if (!granted) {
    showToast('Camera denied — using simulation mode.');
  }

  setTimeout(() => {
    const scanText = document.querySelector('.scanning-reticle .scan-text');
    if (scanText) {
      scanText.textContent = 'Surface detected!';
      scanText.classList.add('success');
    }
    const placeBtn = document.getElementById('btn-place-board');
    if (placeBtn) placeBtn.disabled = false;
    showToast('Surface detected! Tap Place to add board.');
  }, 1200);
}

function placeARBoard() {
  const reticle = document.querySelector('.scanning-reticle');
  const board3d = document.getElementById('ar-3d-board');
  const placeBtn = document.getElementById('btn-place-board');

  if (reticle) reticle.classList.add('hidden');
  if (board3d) board3d.classList.remove('hidden');
  if (placeBtn) placeBtn.disabled = true;

  // Mount the isometric board inside the AR container
  initBoard('isometric-chessboard', { isometric: true });
  showToast('Board placed in AR!');
}

function toggleARAnalysis() {
  const popup = document.getElementById('ar-analysis-popup');
  if (!popup) return;
  popup.classList.toggle('hidden');
  showToast(popup.classList.contains('hidden') ? 'Analysis hidden' : 'Analysis active');
}

onLeave('ar-mode', () => {
  _stopCamera();
  resetAR();
});

// ── Online board click delegation ─────────────────────────────────────────────
// board.js handles selection. We intercept confirmed moves and relay to server.

document.addEventListener('DOMContentLoaded', () => {
  // Intercept clicks on the online chessboard after board.js sets selectedSq=null
  // We hook the `click` event on the container and let board.js handle UI state,
  // but we override the final move emission via board.js's onMoveConfirmed callback.
  // See board.js initBoard opts.onMove.

  // Boot
  spawnParticles('particles');
  initThemeControls();
  initTabs('#screen-learn .category-tabs');

  // Store time control selection
  document.querySelectorAll('[data-tc-mins]').forEach(btn => {
    btn.addEventListener('click', () => {
      sessionStorage.setItem('archess_tc_mins', btn.dataset.tcMins);
    });
  });

  setTimeout(() => restoreSession(), 2500);
});
