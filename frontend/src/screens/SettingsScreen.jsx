import React from 'react';

const BOARD_THEMES = [
  { value: 'neon-cyber',   label: '🌌 Neon Cyber' },
  { value: 'classic-wood', label: '🪵 Classic Wood' },
  { value: 'glass',        label: '💎 Glass' },
  { value: 'midnight',     label: '🌙 Midnight' },
];

export default function SettingsScreen({ boardTheme, setBoardTheme, darkMode, setDarkMode, boardSize, setBoardSize, onLogout, onClearSave }) {
  return (
    <section className="glass-panel panel">
      <h3>Settings</h3>

      {/* ── Appearance ── */}
      <div className="settings-section">
        <h4 className="settings-section-title">Appearance</h4>

        <div className="settings-row">
          <span className="settings-label">{darkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
          <button
            className={`toggle-btn${darkMode ? '' : ' toggle-on'}`}
            onClick={() => setDarkMode(d => !d)}
            aria-label="Toggle dark/light mode"
          >
            <span className="toggle-thumb" />
            <span className="toggle-label">{darkMode ? 'Dark' : 'Light'}</span>
          </button>
        </div>

        <div className="settings-row">
          <label htmlFor="board-theme" className="settings-label">♟ Board Theme</label>
          <select id="board-theme" value={boardTheme} onChange={e => setBoardTheme(e.target.value)}>
            {BOARD_THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="settings-row settings-col">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
            <span className="settings-label">📐 Board Size</span>
            <span className="settings-value">{boardSize}%</span>
          </div>
          <input
            type="range" min={40} max={100} step={5}
            value={boardSize}
            onChange={e => setBoardSize(Number(e.target.value))}
            className="size-slider"
          />
          <div className="slider-labels">
            <span>Small (40%)</span><span>Medium</span><span>Large (100%)</span>
          </div>
        </div>
      </div>

      {/* ── Account ── */}
      <div className="settings-section">
        <h4 className="settings-section-title">Account</h4>
        <div className="settings-row">
          <span className="settings-label">Session</span>
          <button className="danger-btn" onClick={onLogout}>Sign Out</button>
        </div>
        <div className="settings-row">
          <span className="settings-label">Saved Game</span>
          <button className="danger-btn" onClick={onClearSave}>Clear Save</button>
        </div>
      </div>
    </section>
  );
}
