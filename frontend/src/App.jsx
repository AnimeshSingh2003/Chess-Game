import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { io } from 'socket.io-client';
import { PUZZLES } from './data/puzzles.js';

import ErrorBoundary from './components/ErrorBoundary.jsx';
import AuthScreen    from './screens/AuthScreen.jsx';
import HomeScreen    from './screens/HomeScreen.jsx';
import ModesScreen   from './screens/ModesScreen.jsx';
import GameScreen    from './screens/GameScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';

import { minimax }             from './utils/ai.js';
import { playChessSound }      from './utils/sound.js';
import { resolveExpectedUci }  from './utils/uci.js';
import { KEYS, loadSavedGame, saveGameToStorage, clearSavedGame, persistXp } from './utils/storage.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const SERVER_URL   = import.meta.env.VITE_SERVER_URL   || '';

export default function AppWrapper() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}

function App() {
  // ── Auth & user ────────────────────────────────────────────────
  const [screen, setScreen]         = useState('splash');
  const [authToken, setAuthToken]   = useState(() => localStorage.getItem(KEYS.TOKEN) || '');
  const [userId, setUserId]         = useState(() => Number(localStorage.getItem(KEYS.UID)) || null);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(KEYS.USER) || 'Player');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirm,  setFormConfirm]  = useState('');
  const [isSignup,     setIsSignup]     = useState(false);
  const [authError,    setAuthError]    = useState('');
  const [authLoading,  setAuthLoading]  = useState(false);
  const [stats, setStats] = useState(null);

  // ── XP / Level ─────────────────────────────────────────────────
  const [userXp,    setUserXp]    = useState(() => Number(localStorage.getItem(KEYS.XP))    || 0);
  const [userLevel, setUserLevel] = useState(() => Number(localStorage.getItem(KEYS.LEVEL)) || 1);
  const [levelUpMsg, setLevelUpMsg] = useState('');
  const xpToNext   = 100 - (userXp % 100);
  const xpProgress = Math.round(userXp % 100);

  // ── Board / game state ─────────────────────────────────────────
  const [boardTheme,  setBoardTheme]  = useState(() => localStorage.getItem(KEYS.THEME) || 'neon-cyber');
  const [mode,        setMode]        = useState('pvp');
  const [engine,      setEngine]      = useState(() => new Chess());
  const [aiDepth,     setAiDepth]     = useState(2);
  const [aiThinking,  setAiThinking]  = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [savedGame,   setSavedGame]   = useState(null);
  const [drawOffered, setDrawOffered] = useState(false);
  const [arOpponent,  setArOpponent]  = useState('pvp');
  const boardApiRef = useRef(null);
  const [hintLoading, setHintLoading] = useState(false);
  const aiCancelRef = useRef(0);

  // ── Time controls ────────────────────────────────────────────────
  const [timeControl, setTimeControl] = useState('unlimited'); // 'unlimited'|'bullet1'|'bullet2'|'blitz3'|'blitz5'|'rapid10'|'rapid15'|'classical30'
  const [whiteTime,   setWhiteTime]   = useState(null); // seconds remaining
  const [blackTime,   setBlackTime]   = useState(null);
  const clockRef = useRef(null);

  // ── Online / socket state ──────────────────────────────────────
  const socketRef = useRef(null);
  const [netStatus,      setNetStatus]      = useState('offline');
  const [roomCode,       setRoomCode]       = useState('');
  const [joinCode,       setJoinCode]       = useState('');
  const [myColor,        setMyColor]        = useState(null);
  const [notice,         setNotice]         = useState('');
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [movePending,    setMovePending]    = useState(false);
  const [arRoomCode,     setArRoomCode]     = useState('');  // AR multiplayer
  const [arJoinCode,     setArJoinCode]     = useState('');

  // ── Puzzles ────────────────────────────────────────────────────
  const [puzzleIndex,  setPuzzleIndex]  = useState(0);
  const [puzzles,      setPuzzles]      = useState(PUZZLES);
  const [puzzleStatus, setPuzzleStatus] = useState('');

  // ── Derived ────────────────────────────────────────────────────
  const isGameOver = engine.isCheckmate() || engine.isStalemate() || engine.isDraw();

  const selectableColor = useMemo(() => {
    if (mode === 'pvp')                               return null; // both sides local
    if (mode === 'pvai')                              return 'w';
    if (mode === 'ar' && arOpponent === 'pvp')        return null;
    if (mode === 'ar' && arOpponent === 'pvai')       return 'w';
    if (mode === 'ar' && arOpponent === 'pvp-online') return myColor;
    if (mode === 'pvp-online')                        return myColor;
    if (mode === 'puzzle')                            return engine.turn();
    return null;
  }, [mode, myColor, engine, arOpponent]);

  const statusText = useMemo(() => {
    if (engine.isCheckmate()) return `Checkmate — ${engine.turn() === 'w' ? 'Black' : 'White'} wins`;
    if (engine.isStalemate()) return 'Stalemate — Draw';
    if (engine.isDraw())      return 'Draw';
    return `${engine.turn() === 'w' ? '♙ White' : '♟ Black'} to move`;
  }, [engine]);

  // ── Splash / token validation ──────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      const savedToken = localStorage.getItem(KEYS.TOKEN);
      if (savedToken) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            setAuthToken(savedToken);
            setUserId(data.user.id);
            setPlayerName(data.user.username);
            if (data.user.xp    != null) { setUserXp(data.user.xp);     localStorage.setItem(KEYS.XP,    String(data.user.xp)); }
            if (data.user.level != null) { setUserLevel(data.user.level); localStorage.setItem(KEYS.LEVEL, String(data.user.level)); }
            const sg = loadSavedGame();
            if (sg) setSavedGame(sg);
            setScreen('home');
            return;
          }
        } catch (_) {}
      }
      setScreen('login');
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Persist board theme
  useEffect(() => {
    document.body.setAttribute('data-board-theme', boardTheme);
    localStorage.setItem(KEYS.THEME, boardTheme);
  }, [boardTheme]);

  // Reset board when AR opponent mode switches
  useEffect(() => {
    if (mode === 'ar') resetBoard(); // eslint-disable-line react-hooks/exhaustive-deps
  }, [arOpponent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clock tick ────────────────────────────────────────────────
  useEffect(() => {
    if (timeControl === 'unlimited' || isGameOver || !whiteTime || !blackTime) return;
    const turn = engine.turn();
    clockRef.current = setInterval(() => {
      if (turn === 'w') {
        setWhiteTime(t => {
          if (t <= 1) { clearInterval(clockRef.current); recordGameResult('loss'); setNotice('White ran out of time!'); return 0; }
          return t - 1;
        });
      } else {
        setBlackTime(t => {
          if (t <= 1) { clearInterval(clockRef.current); recordGameResult('win'); setNotice('Black ran out of time!'); return 0; }
          return t - 1;
        });
      }
    }, 1000);
    return () => clearInterval(clockRef.current);
  }, [engine, timeControl, isGameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI loop ────────────────────────────────────────────────────
  useEffect(() => {
    const isAiMode = mode === 'pvai' || (mode === 'ar' && arOpponent === 'pvai');
    if (!isAiMode || engine.turn() !== 'b' || engine.isGameOver()) return;
    setAiThinking(true);
    const token = ++aiCancelRef.current;
    const fenSnap = engine.fen();
    const t = setTimeout(() => {
      if (aiCancelRef.current !== token) return;
      try {
        const clone = new Chess(fenSnap);
        const { move } = minimax(clone, aiDepth, -Infinity, Infinity, false);
        if (move && aiCancelRef.current === token) {
          const next = new Chess(fenSnap);
          next.move(move);
          setEngine(next);
          setMoveHistory(next.history());
          saveGameToStorage(next, mode === 'ar' ? 'ar' : 'pvai');
          playChessSound(move.captured ? 'capture' : 'move');
          if (next.isGameOver()) playChessSound('gameover');
          else if (next.isCheck()) { playChessSound('check'); setNotice('Check!'); }
          else setNotice('');
        }
      } catch (_) {}
      setAiThinking(false);
    }, 50);
    return () => { clearTimeout(t); };
  }, [engine, mode, aiDepth, arOpponent]);

  // ── Puzzle FEN load ────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'puzzle' && puzzles[puzzleIndex]) {
      try {
        setEngine(new Chess(puzzles[puzzleIndex].fen));
        setMoveHistory([]);
        setPuzzleStatus('');
      } catch (e) {
        setPuzzleStatus('Error: invalid puzzle — press Next');
      }
    }
  }, [mode, puzzleIndex, puzzles]);

  // Fetch puzzles from backend
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/puzzles?count=120`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (!cancelled && Array.isArray(data.puzzles) && data.puzzles.length) setPuzzles(data.puzzles); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Auto-record game result on game over (all modes except puzzle)
  useEffect(() => {
    if (isGameOver && mode !== 'puzzle') {
      let result = 'draw';
      if (engine.isCheckmate()) result = engine.turn() === 'b' ? 'win' : 'loss';
      recordGameResult(result);
      clearSavedGame();
    }
  }, [isGameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth helpers ───────────────────────────────────────────────
  function authHeader() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  async function handleAuth() {
    setAuthError('');
    if (!formUsername.trim())                           { setAuthError('Username is required'); return; }
    if (formPassword.length < 6)                        { setAuthError('Password must be at least 6 characters'); return; }
    if (isSignup && formPassword !== formConfirm)       { setAuthError('Passwords do not match'); return; }
    setAuthLoading(true);
    const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login';
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formUsername.trim(), password: formPassword }),
      });
      const data = await res.json();
      if (!data.ok) { setAuthError(data.error || 'Failed'); setAuthLoading(false); return; }
      localStorage.setItem(KEYS.TOKEN, data.token);
      localStorage.setItem(KEYS.UID,   String(data.userId));
      localStorage.setItem(KEYS.USER,  data.username);
      persistXp(data.xp ?? 0, data.level ?? 1);
      setAuthToken(data.token); setUserId(data.userId); setPlayerName(data.username);
      setUserXp(data.xp ?? 0); setUserLevel(data.level ?? 1);
      setScreen('home');
    } catch (_) {
      setAuthError('Server unreachable — check connection');
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', headers: authHeader() }).catch(() => {});
    socketRef.current?.disconnect();
    socketRef.current = null;
    [KEYS.TOKEN, KEYS.UID, KEYS.USER, KEYS.XP, KEYS.LEVEL, KEYS.SAVED_GAME].forEach(k => localStorage.removeItem(k));
    setAuthToken(''); setUserId(null); setPlayerName('Player');
    setUserXp(0); setUserLevel(1);
    setNetStatus('offline');
    setScreen('login');
  }

  async function loadStats() {
    if (!authToken) return;
    setStats(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/stats`, { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        if (data.xp    != null) { setUserXp(data.xp);     localStorage.setItem(KEYS.XP,    String(data.xp)); }
        if (data.level != null) { setUserLevel(data.level); localStorage.setItem(KEYS.LEVEL, String(data.level)); }
      } else { setStats(false); }
    } catch (_) { setStats(false); }
  }

  // ── XP helper ──────────────────────────────────────────────────
  function applyXpGain(xpInfo) {
    if (!xpInfo) return;
    setUserXp(xpInfo.new_xp);
    setUserLevel(xpInfo.new_level);
    persistXp(xpInfo.new_xp, xpInfo.new_level);
    if (xpInfo.leveled_up) {
      setLevelUpMsg(`Level Up! Now Level ${xpInfo.new_level}`);
      setTimeout(() => setLevelUpMsg(''), 4000);
    }
  }

  // ── Save / resume ──────────────────────────────────────────────
  function resumeSavedGame() {
    if (!savedGame) return;
    try {
      const eng = new Chess(savedGame.fen);
      setEngine(eng);
      setMoveHistory(eng.history());
      setMode(savedGame.mode);
      setSavedGame(null);
      clearSavedGame();
      setScreen('game');
    } catch (_) { setSavedGame(null); }
  }

  // ── Time control helpers ────────────────────────────────────────
  const TIME_PRESETS = {
    'unlimited': null,
    'bullet1':   60,
    'bullet2':   120,
    'blitz3':    180,
    'blitz5':    300,
    'rapid10':   600,
    'rapid15':   900,
    'classical30': 1800,
  };

  function initClock(tc) {
    clearInterval(clockRef.current);
    const secs = TIME_PRESETS[tc] ?? null;
    setWhiteTime(secs);
    setBlackTime(secs);
  }

  function formatTime(secs) {
    if (secs === null) return '∞';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Socket ─────────────────────────────────────────────────────
  function connectSocket() {
    if (socketRef.current?.connected) return socketRef.current;
    if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.disconnect(); }
    const s = io(SERVER_URL || window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    s.on('connect',       () => { setNetStatus('online'); setNotice(''); });
    s.on('disconnect',    () => setNetStatus('offline'));
    s.on('connect_error', err => { setNetStatus('offline'); setNotice(`Server unreachable: ${err.message}`); });
    s.on('error',         () => setNotice('Connection error — try again'));
    s.on('room:update', state => {
      setEngine(new Chess(state.fen));
      const bothIn = !!(state.players?.white && state.players?.black);
      setOpponentJoined(bothIn);
      setNotice(bothIn ? 'Opponent joined — game started!' : 'Opponent left the game');
    });
    s.on('game:update', ({ state, move: lastMove }) => {
      const newEng = new Chess(state.fen);
      setEngine(newEng);
      setMoveHistory(newEng.history());
      setMovePending(false);
      if (state.isCheckmate || state.isStalemate || state.isDraw) {
        playChessSound('gameover');
        if (state.isCheckmate)      setNotice(`Checkmate — ${state.turn === 'w' ? 'Black' : 'White'} wins!`);
        else if (state.isStalemate) setNotice('Draw — stalemate');
        else                        setNotice('Draw');
      } else if (state.isCheck) {
        playChessSound('check'); setNotice('Check!');
      } else {
        playChessSound(lastMove?.captured ? 'capture' : 'move'); setNotice('');
      }
    });
    s.on('room:expired', ({ reason }) => {
      setNotice(`Room expired: ${reason}`);
      setRoomCode(''); setMyColor(null);
      setOpponentJoined(false); setMovePending(false);
      setMode('pvp'); setScreen('modes');
    });
    s.on('game:forfeit', ({ winner, reason }) => {
      setNotice(`${reason || 'Opponent forfeited'} — ${winner} wins!`);
      playChessSound('gameover');
      recordGameResult(winner === (myColor === 'w' ? 'white' : 'black') ? 'win' : 'loss');
    });
    socketRef.current = s;
    return s;
  }

  // ── Room actions ───────────────────────────────────────────────
  function createRoom() {
    const s = connectSocket();
    s.emit('room:create', { username: playerName }, res => {
      if (!res?.ok) { setNotice(res?.error || 'Could not create room'); return; }
      setRoomCode(res.room.code); setMyColor(res.color === 'white' ? 'w' : 'b');
      setEngine(new Chess(res.room.fen)); setMoveHistory([]);
      setOpponentJoined(false); setMovePending(false);
      setMode('pvp-online'); setScreen('game');
      setNotice(`Room created: ${res.room.code}`);
    });
  }

  function joinRoom() {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setNotice('Enter a room code first'); return; }
    const s = connectSocket();
    s.emit('room:join', { code, username: playerName }, res => {
      if (!res?.ok) { setNotice(res?.error || 'Could not join room'); return; }
      setRoomCode(res.room.code); setMyColor(res.color === 'white' ? 'w' : 'b');
      setEngine(new Chess(res.room.fen)); setMoveHistory([]);
      setOpponentJoined(!!(res.room.players?.white && res.room.players?.black));
      setMovePending(false); setMode('pvp-online'); setScreen('game');
      setNotice(`Joined room: ${res.room.code}`);
    });
  }

  function onlineMove(move) {
    if (!socketRef.current?.connected) { setNotice('Offline — reconnecting…'); connectSocket(); return; }
    if (movePending) return;
    setMovePending(true);
    socketRef.current.emit('game:move',
      { from: move.from, to: move.to, promotion: move.promotion || 'q' },
      res => { if (!res?.ok) { setNotice(res?.error || 'Move rejected'); setMovePending(false); } }
    );
  }

  // ── Board helpers ──────────────────────────────────────────────
  function resetBoard() {
    aiCancelRef.current++;
    setAiThinking(false); setEngine(new Chess()); setMoveHistory([]);
    setMovePending(false); setDrawOffered(false); clearSavedGame(); setSavedGame(null);
  }

  function startMode(nextMode, opts = {}) {
    // Disconnect from any active online room before switching modes
    if (mode === 'pvp-online' && roomCode && !isGameOver) {
      socketRef.current?.emit('room:leave', { code: roomCode });
      setRoomCode(''); setMyColor(null); setOpponentJoined(false);
    }
    aiCancelRef.current++;
    setAiThinking(false); setMode(nextMode); setNotice(''); setMovePending(false); setDrawOffered(false);
    if (nextMode === 'puzzle') setPuzzleStatus('');
    if (nextMode !== 'pvp-online') resetBoard();
    // Apply time control
    const tc = opts.timeControl || 'unlimited';
    setTimeControl(tc);
    initClock(tc);
    setScreen('game');
  }

  function copyRoomCode() {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => setNotice(`Room code: ${roomCode}`));
  }

  // ── Hint ───────────────────────────────────────────────────────
  function requestHint() {
    if (isGameOver || aiThinking || hintLoading) return;
    setHintLoading(true);
    setTimeout(() => {
      try {
        const clone = new Chess(engine.fen());
        const { move } = minimax(clone, 2, -Infinity, Infinity, clone.turn() === 'w');
        if (move) {
          setNotice(`Hint: ${move.san}`);
          boardApiRef.current?.showHint(move.from, move.to);
          setTimeout(() => boardApiRef.current?.showHint(null, null), 4000);
        }
      } catch (_) {}
      setHintLoading(false);
    }, 30);
  }

  // ── Forfeit / Exit online room ─────────────────────────────────
  function handleForfeit() {
    if (mode !== 'pvp-online' || !roomCode) return;
    socketRef.current?.emit('room:forfeit', { code: roomCode });
    recordGameResult('loss');
    setRoomCode(''); setMyColor(null); setOpponentJoined(false); setMovePending(false);
    setMode('pvp'); setScreen('modes');
    setNotice('You forfeited — opponent wins');
  }

  // ── Resign / Draw ──────────────────────────────────────────────
  function handleResign() {
    if (isGameOver) return;
    const loser = engine.turn() === 'w' ? 'White' : 'Black';
    recordGameResult(engine.turn() === 'w' ? 'loss' : 'win');
    setNotice(`${loser} resigned`);
  }

  function handleDrawOffer() {
    if (drawOffered) {
      setNotice('Draw agreed!'); recordGameResult('draw'); setDrawOffered(false);
    } else {
      setDrawOffered(true);
      setNotice('Draw offered — click again to accept or Reset to decline');
    }
  }

  // ── Puzzle ─────────────────────────────────────────────────────
  async function submitPuzzleAttempt(move) {
    const puzzle = puzzles[puzzleIndex];
    if (!puzzle) return;
    const selectedMove = `${move.from}${move.to}${move.promotion || ''}`.toLowerCase();
    const expectedUci  = resolveExpectedUci(puzzle.fen, puzzle.bestMove);
    const correct      = expectedUci ? selectedMove === expectedUci.toLowerCase() : false;
    setPuzzleStatus(correct ? '✓ Correct! Well done.' : '✗ Incorrect — try again or press Next');
    if (authToken) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/puzzle-attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ puzzleId: puzzle._id || String(puzzleIndex), selectedMove, expectedMove: expectedUci || puzzle.bestMove, timeSpentSec: 0 }),
        });
        if (res.ok) applyXpGain(await res.json());
      } catch (_) {}
    }
  }

  // ── Game result ────────────────────────────────────────────────
  async function recordGameResult(result) {
    if (!authToken || !userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/game/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ mode, result, moves: engine.moveNumber(), opponent: mode === 'pvai' ? 'AI' : null, pgn: engine.pgn() }),
      });
      if (res.ok) applyXpGain(await res.json());
    } catch (_) {}
  }

  // ── onMove handler (passed to GameScreen) ─────────────────────
  function handleMove(mv) {
    if (isGameOver) return;
    if (mode === 'pvp-online') { onlineMove(mv); return; }
    const next = new Chess(engine.fen());
    next.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
    setEngine(next);
    setMoveHistory(next.history());
    saveGameToStorage(next, mode);
    playChessSound(mv.captured ? 'capture' : 'move');
    if (next.isGameOver())   { playChessSound('gameover'); }
    else if (next.isCheck()) { playChessSound('check'); setNotice('Check!'); }
    else                       setNotice('');
    if (mode === 'puzzle') submitPuzzleAttempt(mv);
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <main className="app-shell">
      <div className="bg-noise" />

      {levelUpMsg && <div className="levelup-toast"><span>⚡</span> {levelUpMsg}</div>}

      {screen === 'splash' && (
        <section className="screen-card glass-card center-screen">
          <h1>ARChess Nexus</h1>
          <div className="splash-spinner" />
          <p className="muted">Loading…</p>
        </section>
      )}

      {(screen === 'login' || screen === 'signup') && (
        <AuthScreen
          isSignup={isSignup} setIsSignup={v => { setIsSignup(v); setAuthError(''); }}
          formUsername={formUsername} setFormUsername={setFormUsername}
          formPassword={formPassword} setFormPassword={setFormPassword}
          formConfirm={formConfirm}   setFormConfirm={setFormConfirm}
          authError={authError} authLoading={authLoading} onSubmit={handleAuth}
        />
      )}

      {screen !== 'splash' && screen !== 'login' && screen !== 'signup' && (
        <>
          <header className="dashboard-header glass-panel">
            <div className="user-block">
              <button className="avatar-ring" onClick={() => { loadStats(); setScreen('profile'); }}>
                {playerName.slice(0, 2).toUpperCase()}
              </button>
              <div>
                <h1>{playerName}</h1>
                <div className="level-row">
                  <span className="level-badge">Lv {userLevel}</span>
                  <div className="xp-bar-wrap">
                    <div className="xp-bar-fill" style={{ width: `${xpProgress}%` }} />
                  </div>
                  <span className="xp-label">{xpToNext} XP</span>
                </div>
              </div>
            </div>
            <div className="status-pills">
              <span className={`glass-pill ${isGameOver ? 'pill-gameover' : ''}`}>{statusText}</span>
              <span className={`glass-pill net-pill net-${netStatus}`}>● {netStatus}</span>
              {mode === 'pvp-online' && netStatus === 'offline' && (
                <button className="reconnect-btn" onClick={connectSocket}>Reconnect</button>
              )}
              {mode === 'pvp-online' && roomCode && <span className="glass-pill">Room: {roomCode}</span>}
              {notice && <span className="glass-pill notice-pill">{notice}</span>}
            </div>
          </header>

          {screen === 'home' && (
            <HomeScreen
              savedGame={savedGame}
              onResume={resumeSavedGame}
              onDiscardSave={() => { setSavedGame(null); clearSavedGame(); }}
              setScreen={setScreen}
              loadStats={loadStats}
            />
          )}

          {screen === 'modes' && (
            <ModesScreen
              mode={mode}
              joinCode={joinCode} setJoinCode={setJoinCode}
              onStartMode={startMode}
              onCreateRoom={createRoom}
              onJoinRoom={joinRoom}
            />
          )}

          {screen === 'game' && (
            <GameScreen
              mode={mode} engine={engine} myColor={myColor}
              selectableColor={selectableColor} boardApiRef={boardApiRef}
              isGameOver={isGameOver} statusText={statusText}
              moveHistory={moveHistory} showHistory={showHistory} setShowHistory={setShowHistory}
              movePending={movePending} roomCode={roomCode} copied={copied}
              opponentJoined={opponentJoined} joinCode={joinCode} setJoinCode={setJoinCode}
              aiDepth={aiDepth} setAiDepth={setAiDepth} aiCancelRef={aiCancelRef} aiThinking={aiThinking}
              arOpponent={arOpponent} setArOpponent={setArOpponent}
              arRoomCode={arRoomCode} arJoinCode={arJoinCode} setArJoinCode={setArJoinCode}
              puzzleIndex={puzzleIndex} puzzles={puzzles} puzzleStatus={puzzleStatus}
              onNextPuzzle={() => setPuzzleIndex(i => (i + 1) % puzzles.length)}
              hintLoading={hintLoading} drawOffered={drawOffered}
              timeControl={timeControl} setTimeControl={setTimeControl}
              whiteTime={whiteTime} blackTime={blackTime} formatTime={formatTime}
              onMove={handleMove} onReset={resetBoard}
              onRequestHint={requestHint} onDrawOffer={handleDrawOffer} onResign={handleResign}
              onForfeit={handleForfeit}
              onCreateRoom={createRoom} onJoinRoom={joinRoom} onCopyRoomCode={copyRoomCode}
              onStartMode={startMode}
              userXp={userXp} boardTheme={boardTheme}
            />
          )}

          {screen === 'profile' && (
            <ProfileScreen
              playerName={playerName} userXp={userXp} userLevel={userLevel}
              xpProgress={xpProgress} xpToNext={xpToNext} stats={stats}
              onLoadStats={loadStats}
            />
          )}

          {screen === 'settings' && (
            <SettingsScreen
              boardTheme={boardTheme} setBoardTheme={setBoardTheme}
              onLogout={handleLogout}
              onClearSave={() => { clearSavedGame(); setSavedGame(null); setNotice('Saved game cleared'); }}
            />
          )}

          <nav className="bottom-nav glass-panel">
            <button className={`nav-item ${screen === 'home'    ? 'active' : ''}`} onClick={() => setScreen('home')}>Home</button>
            <button className={`nav-item ${screen === 'modes'   ? 'active' : ''}`} onClick={() => setScreen('modes')}>Modes</button>
            <button className={`nav-item ${screen === 'game' && mode !== 'ar' ? 'active' : ''}`} onClick={() => mode === 'ar' ? startMode('pvp') : setScreen('game')}>Game</button>
            <button className={`nav-item ${mode === 'ar' && screen === 'game' ? 'active' : ''}`}
              onClick={() => { setMode('ar'); setScreen('game'); }}>AR</button>
            <button className={`nav-item ${screen === 'settings' ? 'active' : ''}`} onClick={() => setScreen('settings')}>Settings</button>
          </nav>
        </>
      )}
    </main>
  );
}
