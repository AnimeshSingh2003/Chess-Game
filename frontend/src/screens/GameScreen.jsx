import React from 'react';
import ARPanel from '../components/ARPanel.jsx';

export default function GameScreen({
  mode, engine, myColor, selectableColor,
  boardApiRef, isGameOver, statusText,
  moveHistory, showHistory, setShowHistory,
  movePending, roomCode, copied,
  opponentJoined, joinCode, setJoinCode,
  aiDepth, setAiDepth, aiCancelRef, aiThinking,
  arOpponent, setArOpponent,
  puzzleIndex, puzzles, puzzleStatus, onNextPuzzle,
  hintLoading, drawOffered,
  onMove, onReset, onRequestHint, onDrawOffer, onResign,
  onCreateRoom, onJoinRoom, onCopyRoomCode,
  userXp, boardTheme,
}) {
  const puzzle = puzzles[puzzleIndex];

  return (
    <section className="panel gameplay-screen glass-panel">

      {/* ── Mode-specific toolbar ── */}
      {mode === 'pvai' && (
        <div className="row">
          <label htmlFor="ai-difficulty">Difficulty</label>
          <select id="ai-difficulty" value={aiDepth}
            onChange={e => { setAiDepth(Number(e.target.value)); aiCancelRef.current++; }}>
            <option value={1}>Beginner</option>
            <option value={2}>Intermediate</option>
            <option value={3}>Expert</option>
          </select>
          <span className={`ai-status${aiThinking ? ' thinking' : ''}`}>
            {aiThinking ? '⏳ AI thinking…' : '✓ Ready'}
          </span>
        </div>
      )}

      {mode === 'ar' && (
        <div className="ar-opponent-row">
          <span className="ar-opp-label">AR Opponent</span>
          <div className="ar-opp-toggle">
            <button className={`ar-opp-btn${arOpponent === 'pvp'  ? ' active' : ''}`} onClick={() => setArOpponent('pvp')}>
              👥 2 Players
            </button>
            <button className={`ar-opp-btn${arOpponent === 'pvai' ? ' active' : ''}`} onClick={() => setArOpponent('pvai')}>
              🤖 vs AI
            </button>
          </div>
          {arOpponent === 'pvai' && (
            <select value={aiDepth} onChange={e => { setAiDepth(Number(e.target.value)); aiCancelRef.current++; }} style={{ fontSize: '0.8rem' }}>
              <option value={1}>Easy</option>
              <option value={2}>Medium</option>
              <option value={3}>Hard</option>
            </select>
          )}
          {arOpponent === 'pvai' && aiThinking && (
            <span className="ai-status thinking">⏳ AI thinking…</span>
          )}
        </div>
      )}

      {mode === 'puzzle' && (
        <div className="row">
          <span className="puzzle-meta">#{puzzleIndex + 1} · {puzzle?.category} · Elo {puzzle?.elo}</span>
          {puzzleStatus && (
            <strong className={puzzleStatus.startsWith('✓') ? 'status-correct' : 'status-wrong'}>
              {puzzleStatus}
            </strong>
          )}
          <button onClick={onNextPuzzle}>Next →</button>
        </div>
      )}

      {/* ── Board ── */}
      <div className="board-container holographic">
        {/* Game-over overlay (non-AR modes) */}
        {isGameOver && mode !== 'ar' && (
          <div className="gameover-overlay">
            <div className="gameover-card glass-card">
              <p className="gameover-title">{statusText}</p>
              {userXp > 0 && <p className="gameover-xp">+XP earned</p>}
              <button className="primary-btn" onClick={onReset}>Play Again</button>
              {mode === 'pvp-online' && (
                <button className="primary-btn" style={{ marginTop: 8 }} onClick={onCreateRoom}>New Room</button>
              )}
            </div>
          </div>
        )}

        {/* Move-pending spinner overlay */}
        {movePending && mode === 'pvp-online' && (
          <div className="pending-overlay">
            <div className="waiting-spinner small" />
          </div>
        )}

        <ARPanel
          key={mode + (myColor || '')}
          engine={engine}
          flipped={myColor === 'b'}
          selectableColor={selectableColor}
          enableAR={mode === 'ar'}
          boardApiRef={boardApiRef}
          boardTheme={boardTheme}
          statusText={statusText}
          isGameOver={isGameOver}
          onReset={onReset}
          moveHistory={moveHistory}
          showHistory={showHistory}
          onToggleHistory={() => setShowHistory(h => !h)}
          hintLoading={hintLoading}
          onRequestHint={onRequestHint}
          onMove={onMove}
        />
      </div>

      {/* ── Game controls (hidden in AR fullscreen via body.ar-fullscreen CSS) ── */}
      <div className="game-controls">
        <button onClick={onReset} className="ctrl-btn">↺ Reset</button>
        {mode !== 'puzzle' && mode !== 'pvp-online' && (
          <>
            <button onClick={onRequestHint} className="ctrl-btn hint-btn" disabled={hintLoading || isGameOver}>
              {hintLoading ? <span className="btn-spinner" /> : '💡'} Hint
            </button>
            <button onClick={onDrawOffer} className={`ctrl-btn${drawOffered ? ' draw-active' : ''}`} disabled={isGameOver}>
              {drawOffered ? '✓ Accept Draw' : '½ Draw'}
            </button>
            <button onClick={onResign} className="ctrl-btn resign-btn" disabled={isGameOver}>⚑ Resign</button>
          </>
        )}
        <button onClick={() => setShowHistory(h => !h)} className={`ctrl-btn${showHistory ? ' active' : ''}`}>
          📋 {showHistory ? 'Hide' : 'Moves'}
        </button>
      </div>

      {/* ── Move history panel ── */}
      {showHistory && (
        <div className="history-panel glass-card">
          <div className="history-header">
            <span>Move History</span>
            <span className="muted">{moveHistory.length} moves</span>
          </div>
          {moveHistory.length === 0 ? (
            <p className="muted" style={{ padding: '8px 0' }}>No moves yet</p>
          ) : (
            <div className="history-grid">
              {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                <div key={i} className="history-pair">
                  <span className="move-num">{i + 1}.</span>
                  <span className="move-san white-move">{moveHistory[i * 2]}</span>
                  <span className="move-san black-move">{moveHistory[i * 2 + 1] || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Online room info ── */}
      {mode === 'pvp-online' && roomCode && (
        <div className="room-banner glass-pill">
          <span>Room: <strong>{roomCode}</strong></span>
          <button className="copy-btn" onClick={onCopyRoomCode}>{copied ? '✓ Copied' : '⎘ Copy'}</button>
        </div>
      )}

      {mode === 'pvp-online' && !opponentJoined && (
        <div className="waiting-panel glass-card">
          <div className="waiting-spinner" />
          <p className="waiting-text">Waiting for opponent…</p>
          <p className="muted">Share code <strong>{roomCode}</strong></p>
        </div>
      )}

      {/* ── Quick online join ── */}
      <div className="row">
        <button onClick={onCreateRoom}>New Online Room</button>
        <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Room code" maxLength={8} />
        <button onClick={onJoinRoom} disabled={!joinCode.trim()}>Join</button>
      </div>
    </section>
  );
}
