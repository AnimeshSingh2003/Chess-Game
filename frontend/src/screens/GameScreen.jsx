import React, { useState } from 'react';
import ARPanel from '../components/ARPanel.jsx';

export default function GameScreen({
  mode, engine, myColor, selectableColor,
  boardApiRef, isGameOver, statusText,
  moveHistory, showHistory, setShowHistory,
  movePending, roomCode, copied,
  opponentJoined, joinCode, setJoinCode,
  aiDepth, setAiDepth, aiCancelRef, aiThinking,
  arOpponent, setArOpponent,
  arRoomCode, arJoinCode, setArJoinCode,
  puzzleIndex, puzzles, puzzleStatus, onNextPuzzle,
  hintLoading, drawOffered,
  timeControl, setTimeControl, whiteTime, blackTime, formatTime,
  onMove, onReset, onRequestHint, onDrawOffer, onResign, onForfeit,
  onCreateRoom, onJoinRoom, onCopyRoomCode, onStartMode,
  userXp, boardTheme,
}) {
  const puzzle = puzzles[puzzleIndex];

  // Board is flipped when playing as black in any online mode
  const flipped = myColor === 'b';

  const TIME_LABELS = {
    'unlimited':   '∞ Unlimited',
    'bullet1':     '⚡ 1 min',
    'bullet2':     '⚡ 2 min',
    'blitz3':      '🔥 3 min',
    'blitz5':      '🔥 5 min',
    'rapid10':     '⏱ 10 min',
    'rapid15':     '⏱ 15 min',
    'classical30': '🎓 30 min',
  };

  return (
    <section className="panel gameplay-screen glass-panel">

      {/* ── VS AI toolbar ── */}
      {mode === 'pvai' && (
        <div className="mode-toolbar">
          <div className="toolbar-row">
            <label htmlFor="ai-difficulty">Difficulty</label>
            <select id="ai-difficulty" value={aiDepth}
              onChange={e => { setAiDepth(Number(e.target.value)); aiCancelRef.current++; }}>
              <option value={1}>🟢 Beginner</option>
              <option value={2}>🟡 Intermediate</option>
              <option value={3}>🔴 Expert</option>
            </select>
            <span className={`ai-status${aiThinking ? ' thinking' : ''}`}>
              {aiThinking ? '⏳ Thinking…' : '✓ Ready'}
            </span>
          </div>
          <TimeControlPicker timeControl={timeControl} setTimeControl={setTimeControl} labels={TIME_LABELS} onReset={onReset} />
        </div>
      )}

      {/* ── PvP Local toolbar ── */}
      {mode === 'pvp' && (
        <div className="mode-toolbar">
          <TimeControlPicker timeControl={timeControl} setTimeControl={setTimeControl} labels={TIME_LABELS} onReset={onReset} />
        </div>
      )}

      {/* ── AR toolbar ── */}
      {mode === 'ar' && (
        <div className="mode-toolbar">
          <div className="ar-opp-toggle">
            <button className={`ar-opp-btn${arOpponent === 'pvp'        ? ' active' : ''}`} onClick={() => setArOpponent('pvp')}>👥 Local</button>
            <button className={`ar-opp-btn${arOpponent === 'pvai'       ? ' active' : ''}`} onClick={() => setArOpponent('pvai')}>🤖 vs AI</button>
            <button className={`ar-opp-btn${arOpponent === 'pvp-online' ? ' active' : ''}`} onClick={() => setArOpponent('pvp-online')}>🌐 Online</button>
          </div>
          {arOpponent === 'pvai' && (
            <select value={aiDepth} onChange={e => { setAiDepth(Number(e.target.value)); aiCancelRef.current++; }}>
              <option value={1}>Easy</option><option value={2}>Medium</option><option value={3}>Hard</option>
            </select>
          )}
          {arOpponent === 'pvai' && aiThinking && <span className="ai-status thinking">⏳ Thinking…</span>}
          {arOpponent === 'pvp-online' && (
            <div className="ar-online-row">
              <button className="ctrl-btn" onClick={onCreateRoom}>+ Room</button>
              <input value={arJoinCode || ''} onChange={e => setArJoinCode(e.target.value.toUpperCase())}
                placeholder="Code" maxLength={8} style={{ width: 80 }} />
              <button className="ctrl-btn" onClick={onJoinRoom} disabled={!(arJoinCode || '').trim()}>Join</button>
              {arRoomCode && <span className="glass-pill" style={{ fontSize: '0.8rem' }}>Room: <strong>{arRoomCode}</strong></span>}
            </div>
          )}
        </div>
      )}

      {/* ── Puzzle toolbar ── */}
      {mode === 'puzzle' && (
        <div className="mode-toolbar">
          <span className="puzzle-meta">#{puzzleIndex + 1} · {puzzle?.category || 'Tactical'} · Elo {puzzle?.elo || '?'}</span>
          {puzzleStatus && (
            <strong className={puzzleStatus.startsWith('✓') ? 'status-correct' : 'status-wrong'}>{puzzleStatus}</strong>
          )}
          <button onClick={onNextPuzzle}>Next →</button>
        </div>
      )}

      {/* ── Online: color indicator ── */}
      {mode === 'pvp-online' && myColor && (
        <div className="mode-toolbar color-indicator">
          You play as: <strong style={{ color: myColor === 'w' ? '#fff' : '#aaa', marginLeft: 6 }}>
            {myColor === 'w' ? '♙ White' : '♟ Black'}
          </strong>
          <span className="muted" style={{ marginLeft: 8, fontSize: '0.8rem' }}>(board {myColor === 'b' ? 'flipped' : 'normal'})</span>
        </div>
      )}

      {/* ── Clock ── */}
      {timeControl !== 'unlimited' && whiteTime !== null && (
        <div className="clock-row">
          <div className={`clock-box${engine.turn() === 'b' ? ' clock-active' : ''}`}>
            <span className="clock-label">♟ Black</span>
            <span className="clock-time">{formatTime(blackTime)}</span>
          </div>
          <span className="clock-vs">vs</span>
          <div className={`clock-box${engine.turn() === 'w' ? ' clock-active' : ''}`}>
            <span className="clock-label">♙ White</span>
            <span className="clock-time">{formatTime(whiteTime)}</span>
          </div>
        </div>
      )}

      {/* ── Board ── */}
      <div className="board-container holographic">
        {isGameOver && mode !== 'ar' && (
          <div className="gameover-overlay">
            <div className="gameover-card glass-card">
              <p className="gameover-title">{statusText}</p>
              {userXp > 0 && <p className="gameover-xp">+XP earned</p>}
              <button className="primary-btn" onClick={onReset}>▶ Play Again</button>
              {mode === 'pvp-online' && (
                <button className="primary-btn" style={{ marginTop: 8 }} onClick={onCreateRoom}>New Room</button>
              )}
            </div>
          </div>
        )}
        {movePending && mode === 'pvp-online' && (
          <div className="pending-overlay"><div className="waiting-spinner small" /></div>
        )}
        <ARPanel
          key={mode + (myColor || '') + arOpponent}
          engine={engine}
          flipped={flipped}
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
          onExitAR={() => onStartMode('pvp')}
        />
      </div>

      {/* ── Controls ── */}
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
        {mode === 'pvp-online' && !isGameOver && (
          <button onClick={onForfeit} className="ctrl-btn resign-btn">🚪 Exit &amp; Forfeit</button>
        )}
        <button onClick={() => setShowHistory(h => !h)} className={`ctrl-btn${showHistory ? ' active' : ''}`}>
          📋 {showHistory ? 'Hide' : 'Moves'}
        </button>
      </div>

      {/* ── Move history ── */}
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

      {/* ── Online room waiting ── */}
      {mode === 'pvp-online' && roomCode && !opponentJoined && (
        <div className="waiting-panel glass-card">
          <div className="waiting-spinner" />
          <p className="waiting-text">Waiting for opponent…</p>
          <p className="muted">Share code <strong>{roomCode}</strong></p>
          <button className="copy-btn" style={{ marginTop: 8 }} onClick={onCopyRoomCode}>
            {copied ? '✓ Copied' : '⎘ Copy Code'}
          </button>
        </div>
      )}
      {mode === 'pvp-online' && roomCode && opponentJoined && (
        <div className="room-banner glass-pill">
          <span>Room: <strong>{roomCode}</strong></span>
          <button className="copy-btn" onClick={onCopyRoomCode}>{copied ? '✓ Copied' : '⎘ Copy'}</button>
        </div>
      )}

      {/* ── Quick online join (only when not in online mode) ── */}
      {mode !== 'pvp-online' && mode !== 'ar' && (
        <div className="online-quick-row">
          <button className="ctrl-btn" onClick={onCreateRoom}>🌐 Online Room</button>
          <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Room code" maxLength={8} />
          <button className="ctrl-btn" onClick={onJoinRoom} disabled={!joinCode.trim()}>Join</button>
        </div>
      )}
    </section>
  );
}

// ── Time Control Picker ────────────────────────────────────────
function TimeControlPicker({ timeControl, setTimeControl, labels, onReset }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="time-control-picker" style={{ position: 'relative' }}>
      <button className="ctrl-btn tc-btn" onClick={() => setOpen(o => !o)}>
        🕐 {labels[timeControl]} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="tc-dropdown glass-card">
          {Object.entries(labels).map(([key, label]) => (
            <button key={key}
              className={`tc-option${timeControl === key ? ' tc-active' : ''}`}
              onClick={() => { setTimeControl(key); onReset(); setOpen(false); }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

