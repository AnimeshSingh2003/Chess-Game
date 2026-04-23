/**
 * router.js — Screen navigation & lifecycle hooks
 * Manages the single-page app's screen transitions and per-screen
 * init/teardown callbacks so each screen's logic lives in its own module.
 */

const VALID_SCREENS = [
  'splash', 'login', 'home', 'modes',
  'standard-game', 'online-game', 'ai-game',
  'ar-mode', 'profile', 'puzzles', 'learn', 'settings'
];

let currentScreen = 'splash';
const onEnterHooks = {};
const onLeaveHooks = {};

export function onEnter(screenId, fn) {
  onEnterHooks[screenId] = fn;
}

export function onLeave(screenId, fn) {
  onLeaveHooks[screenId] = fn;
}

export function currentScreenId() {
  return currentScreen;
}

export function nav(screenId) {
  if (!VALID_SCREENS.includes(screenId)) {
    console.warn(`[router] Unknown screen: "${screenId}"`);
    return;
  }

  // Leave current
  const prevEl = document.getElementById(`screen-${currentScreen}`);
  if (prevEl) prevEl.classList.remove('active');
  if (onLeaveHooks[currentScreen]) onLeaveHooks[currentScreen]();

  // Enter next
  currentScreen = screenId;
  const nextEl = document.getElementById(`screen-${currentScreen}`);
  if (nextEl) nextEl.classList.add('active');
  if (onEnterHooks[currentScreen]) onEnterHooks[currentScreen]();
}
