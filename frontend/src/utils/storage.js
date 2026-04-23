// localStorage keys and helpers

export const KEYS = {
  TOKEN:      'archess_token',
  UID:        'archess_uid',
  USER:       'archess_user',
  XP:         'archess_xp',
  LEVEL:      'archess_level',
  THEME:      'archess_theme',
  SAVED_GAME: 'archess_saved_game',
};

export function loadSavedGame() {
  try {
    const sg = JSON.parse(localStorage.getItem(KEYS.SAVED_GAME) || 'null');
    if (sg && Date.now() - sg.timestamp < 24 * 3600 * 1000) return sg;
  } catch (_) {}
  return null;
}

export function saveGameToStorage(engine, mode) {
  if (mode === 'pvp' || mode === 'pvai' || mode === 'ar') {
    try {
      localStorage.setItem(KEYS.SAVED_GAME, JSON.stringify({
        mode, fen: engine.fen(), timestamp: Date.now(),
      }));
    } catch (_) {}
  }
}

export function clearSavedGame() {
  localStorage.removeItem(KEYS.SAVED_GAME);
}

export function persistXp(xp, level) {
  localStorage.setItem(KEYS.XP,    String(xp));
  localStorage.setItem(KEYS.LEVEL, String(level));
}
