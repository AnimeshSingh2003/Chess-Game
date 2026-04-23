/**
 * auth.js — Username-based session management (localStorage)
 * No passwords are stored. Users pick a display name; a unique
 * client-generated tag is stored alongside. No personal data is
 * transmitted to any server.
 */

import { showToast } from './ui.js';
import { nav } from './router.js';

const STORAGE_KEYS = {
  user: 'archess_user',
  id: 'archess_id',
  avatarIndex: 'archess_avatar',
  customAvatar: 'archess_custom_avatar',
};

// Only a local blocklist — server-side uniqueness enforcement happens in
// the multiplayer server when/if a real account system is added.
const LOCAL_RESERVED = new Set(['playerone', 'grandmasterx', 'anand_a', 'chessmaster99', 'guest', 'admin']);

let currentUser = null; // { username, id, avatarIndex, customAvatar }

// ── Public getters ──────────────────────────────────────────────────────────

export function getUser() {
  return currentUser;
}

export function getUsername() {
  return currentUser ? currentUser.username : 'Guest';
}

export function getUserId() {
  return currentUser ? currentUser.id : '';
}

// ── Session restore ─────────────────────────────────────────────────────────

export function restoreSession() {
  const username = localStorage.getItem(STORAGE_KEYS.user);
  const id = localStorage.getItem(STORAGE_KEYS.id);
  if (!username || !id) {
    nav('login');
    return;
  }

  const rawIndex = localStorage.getItem(STORAGE_KEYS.avatarIndex);
  const avatarIndex = rawIndex ? Number.parseInt(rawIndex, 10) : 11;
  const customAvatar = localStorage.getItem(STORAGE_KEYS.customAvatar) || null;

  currentUser = { username, id, avatarIndex, customAvatar };
  _applyUserToDOM();
  nav('home');
  showToast(`Welcome back, ${username} ${id}!`);
}

// ── Registration ─────────────────────────────────────────────────────────────

export function promptUsername() {
  document.getElementById('login-main-card').classList.add('hidden');
  document.getElementById('username-prompt-card').classList.remove('hidden');
}

export function cancelUsernamePrompt() {
  document.getElementById('username-prompt-card').classList.add('hidden');
  document.getElementById('login-main-card').classList.remove('hidden');
  document.getElementById('username-input').value = '';
}

export function submitUsername() {
  const inputEl = document.getElementById('username-input');
  if (!inputEl) return;

  const raw = inputEl.value.trim();

  // Sanitise: allow only letters, numbers, underscores, hyphens (3-20 chars)
  if (!/^[\w-]{3,20}$/.test(raw)) {
    showToast('3–20 chars: letters, numbers, _ or - only.');
    return;
  }

  const lower = raw.toLowerCase();
  if (LOCAL_RESERVED.has(lower)) {
    showToast('Username already taken. Choose another.');
    return;
  }

  const id = _generateId();
  currentUser = { username: raw, id, avatarIndex: 11, customAvatar: null };

  localStorage.setItem(STORAGE_KEYS.user, raw);
  localStorage.setItem(STORAGE_KEYS.id, id);

  LOCAL_RESERVED.add(lower);

  _applyUserToDOM();
  cancelUsernamePrompt();
  nav('home');
  showToast(`Welcome to the Nexus, ${raw} ${id}!`);
}

// ── Logout ───────────────────────────────────────────────────────────────────

export function logout() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  currentUser = null;
  _applyUserToDOM();
  nav('login');
  showToast('Logged out successfully.');
}

// ── Avatar ────────────────────────────────────────────────────────────────────

export function openAvatarModal() {
  document.getElementById('avatar-modal').classList.remove('hidden');
}

export function closeAvatarModal() {
  document.getElementById('avatar-modal').classList.add('hidden');
}

export function selectAvatar(src) {
  if (src.includes('pravatar.cc')) {
    const idx = Number.parseInt(src.split('img=')[1], 10);
    if (currentUser) {
      currentUser.avatarIndex = idx;
      currentUser.customAvatar = null;
    }
    localStorage.setItem(STORAGE_KEYS.avatarIndex, idx);
    localStorage.removeItem(STORAGE_KEYS.customAvatar);
  } else {
    if (currentUser) currentUser.customAvatar = src;
    try {
      localStorage.setItem(STORAGE_KEYS.customAvatar, src);
    } catch {
      showToast('Storage full — avatar not saved permanently.');
    }
  }

  document.querySelectorAll('[data-avatar-img]').forEach(img => { img.src = src; });
  closeAvatarModal();
  showToast('Avatar updated!');
}

export function handleAvatarUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 512 * 1024) {
    showToast('Image too large. Max 500 KB.');
    event.target.value = '';
    return;
  }

  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file.');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => selectAvatar(e.target.result);
  reader.readAsDataURL(file);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _generateId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '#';
  for (let i = 0; i < 6; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function _applyUserToDOM() {
  const username = currentUser ? currentUser.username : '—';
  const id = currentUser ? currentUser.id : '';
  const avatarSrc = currentUser
    ? (currentUser.customAvatar || `https://i.pravatar.cc/150?img=${currentUser.avatarIndex}`)
    : 'https://i.pravatar.cc/150?img=11';

  document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = username; });
  document.querySelectorAll('[data-user-id]').forEach(el => { el.textContent = id; });
  document.querySelectorAll('[data-user-tag]').forEach(el => { el.textContent = `@${username.toLowerCase()}`; });
  document.querySelectorAll('[data-avatar-img]').forEach(img => { img.src = avatarSrc; });
}
