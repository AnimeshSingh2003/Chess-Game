import React from 'react';

export default function ModesScreen({ mode, joinCode, setJoinCode, onStartMode, onCreateRoom, onJoinRoom }) {
  return (
    <section className="glass-panel panel">
      <h3>Choose Mode</h3>
      <div className="action-grid">
        <button className={`action-card ${mode === 'pvp' ? 'active' : ''}`}
          onClick={() => onStartMode('pvp')}>
          <span className="icon-wrapper blue-glow">P2P</span><span>PvP Local</span>
        </button>
        <button className={`action-card ${mode === 'pvai' ? 'active' : ''}`}
          onClick={() => onStartMode('pvai')}>
          <span className="icon-wrapper purple-glow">AI</span><span>vs AI</span>
        </button>
        <button className={`action-card ${mode === 'puzzle' ? 'active' : ''}`}
          onClick={() => onStartMode('puzzle')}>
          <span className="icon-wrapper green-glow">PZ</span><span>Puzzles</span>
        </button>
        <button className={`action-card ${mode === 'ar' ? 'active' : ''}`}
          onClick={() => onStartMode('ar')}>
          <span className="icon-wrapper cyan-glow">AR</span><span>AR Mode</span>
        </button>
        <button className={`action-card ${mode === 'pvp-online' ? 'active' : ''}`}
          onClick={onCreateRoom}>
          <span className="icon-wrapper yellow-glow">ON</span><span>Create Room</span>
        </button>
      </div>

      <div className="join-row">
        <input
          className="join-input"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Enter room code…"
          maxLength={8}
          onKeyDown={e => e.key === 'Enter' && joinCode.trim() && onJoinRoom()}
        />
        <button className="join-btn" onClick={onJoinRoom} disabled={!joinCode.trim()}>Join Room</button>
      </div>
    </section>
  );
}
