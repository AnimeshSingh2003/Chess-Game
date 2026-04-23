import React from 'react';

export default function HomeScreen({ savedGame, onResume, onDiscardSave, setScreen, loadStats }) {
  return (
    <section className="glass-panel panel">
      <h3>Dashboard</h3>

      {savedGame && (
        <div className="resume-banner glass-card">
          <span>💾 Saved {savedGame.mode.toUpperCase()} game found</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary-btn small-btn" onClick={onResume}>Resume</button>
            <button className="link-btn" onClick={onDiscardSave}>Discard</button>
          </div>
        </div>
      )}

      <div className="action-grid">
        <button className="action-card" onClick={() => setScreen('modes')}>
          <span className="icon-wrapper blue-glow">PL</span><span>Play Modes</span>
        </button>
        <button className="action-card" onClick={() => setScreen('game')}>
          <span className="icon-wrapper purple-glow">GM</span><span>Board</span>
        </button>
        <button className="action-card" onClick={() => { loadStats(); setScreen('profile'); }}>
          <span className="icon-wrapper green-glow">PR</span><span>My Profile</span>
        </button>
        <button className="action-card" onClick={() => setScreen('settings')}>
          <span className="icon-wrapper yellow-glow">ST</span><span>Settings</span>
        </button>
      </div>
    </section>
  );
}
