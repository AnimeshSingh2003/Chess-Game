import React, { useState } from 'react';

const MODES = [
  { id: 'pvp',       label: 'Local PvP',    icon: '👥', glow: 'blue-glow',   desc: 'Two players, one device' },
  { id: 'pvai',      label: 'vs AI',        icon: '🤖', glow: 'purple-glow', desc: 'Play against the engine' },
  { id: 'puzzle',    label: 'Puzzles',      icon: '🧩', glow: 'green-glow',  desc: 'Tactical training' },
  { id: 'ar',        label: 'AR Mode',      icon: '📷', glow: 'cyan-glow',   desc: '3D AR chess board' },
  { id: 'pvp-online',label: 'Online PvP',   icon: '🌐', glow: 'yellow-glow', desc: 'Play with friends online' },
];

const TIME_CONTROLS = [
  { key: 'unlimited',   label: '∞ Unlimited' },
  { key: 'bullet1',     label: '⚡ Bullet 1m' },
  { key: 'bullet2',     label: '⚡ Bullet 2m' },
  { key: 'blitz3',      label: '🔥 Blitz 3m' },
  { key: 'blitz5',      label: '🔥 Blitz 5m' },
  { key: 'rapid10',     label: '⏱ Rapid 10m' },
  { key: 'rapid15',     label: '⏱ Rapid 15m' },
  { key: 'classical30', label: '🎓 Classical 30m' },
];

export default function ModesScreen({ mode, joinCode, setJoinCode, onStartMode, onCreateRoom, onJoinRoom }) {
  const [selectedTc, setSelectedTc] = useState('unlimited');

  function handleStart(modeId) {
    if (modeId === 'pvp-online') { onCreateRoom(); return; }
    onStartMode(modeId, { timeControl: selectedTc });
  }

  return (
    <section className="glass-panel panel">
      <h3>Choose Mode</h3>

      <div className="action-grid">
        {MODES.map(m => (
          <button key={m.id}
            className={`action-card ${mode === m.id ? 'active' : ''}`}
            onClick={() => handleStart(m.id)}>
            <span className={`icon-wrapper ${m.glow}`}>{m.icon}</span>
            <span className="mode-label">{m.label}</span>
            <span className="mode-desc">{m.desc}</span>
          </button>
        ))}
      </div>

      {/* Time Control selector (for local modes) */}
      <div className="tc-section">
        <span className="tc-section-label">⏱ Time Control</span>
        <div className="tc-grid">
          {TIME_CONTROLS.map(tc => (
            <button key={tc.key}
              className={`tc-chip${selectedTc === tc.key ? ' tc-active' : ''}`}
              onClick={() => setSelectedTc(tc.key)}>
              {tc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Join room */}
      <div className="join-row">
        <input
          className="join-input"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Enter room code to join…"
          maxLength={8}
          onKeyDown={e => e.key === 'Enter' && joinCode.trim() && onJoinRoom()}
        />
        <button className="join-btn" onClick={onJoinRoom} disabled={!joinCode.trim()}>Join Room</button>
      </div>
    </section>
  );
}
