import React from 'react';

export default function SettingsScreen({ boardTheme, setBoardTheme, onLogout, onClearSave }) {
  return (
    <section className="glass-panel panel">
      <h3>Settings</h3>

      <div className="settings-row">
        <label htmlFor="board-theme">Board Theme</label>
        <select id="board-theme" value={boardTheme} onChange={e => setBoardTheme(e.target.value)}>
          <option value="neon-cyber">Neon Cyber</option>
          <option value="classic-wood">Classic Wood</option>
          <option value="glass">Glass</option>
          <option value="midnight">Midnight</option>
        </select>
      </div>

      <div className="settings-row">
        <label>Account</label>
        <button className="danger-btn" onClick={onLogout}>Sign Out</button>
      </div>

      <div className="settings-row">
        <label>Data</label>
        <button className="danger-btn" onClick={onClearSave}>Clear Saved Game</button>
      </div>
    </section>
  );
}
