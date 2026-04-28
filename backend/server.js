import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';
import {
  initDatabase,
  registerUser,
  loginUser,
  getUserFromToken,
  logoutToken,
  saveGameResult,
  savePuzzleAttempt,
  getUserStats,
} from './db.js';

// ── Config ────────────────────────────────────────────────────
const PORT = Number.parseInt(process.env.PORT || '3001', 10);
const ROOM_TTL_MS = 30 * 60 * 1000;
const MAX_ROOMS_PER_IP = 5;
const MOVE_RATE_MS = 200;

// Allow any localhost / private LAN origin
const ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|(192\.168|10\.\d+|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+)(:\d+)?$/;

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (process.env.CLIENT_ORIGIN) {
    return process.env.CLIENT_ORIGIN.split(',').map(v => v.trim()).includes(origin);
  }
  return ORIGIN_RE.test(origin);
};

// ── Auth rate limiter (no extra packages) ────────────────────
const authAttempts = new Map(); // ip → { count, resetAt }
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX = 10;

function authRateLimiter(req, res, next) {
  const ip = (req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip ?? 'unknown').trim();
  const now = Date.now();
  let rec = authAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + AUTH_WINDOW_MS };
    authAttempts.set(ip, rec);
  }
  if (rec.count >= AUTH_MAX) {
    const wait = Math.ceil((rec.resetAt - now) / 1000);
    return res.status(429).json({ ok: false, error: `Too many attempts — try again in ${wait}s` });
  }
  rec.count++;
  next();
}

// Purge old rate-limit records every 30 min to avoid memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of authAttempts) {
    if (now > rec.resetAt) authAttempts.delete(ip);
  }
}, 30 * 60 * 1000);

// ── Validation helpers ────────────────────────────────────────
const SAFE_NAME_RE = /^[\w\- ]{1,24}$/;
const ROOM_CODE_RE = /^[A-Z2-9]{4,8}$/;

function sanitiseName(raw) {
  if (typeof raw !== 'string') return 'Guest';
  const trimmed = raw.trim().slice(0, 24);
  return SAFE_NAME_RE.test(trimmed) ? trimmed : 'Guest';
}

function validateSquare(sq) {
  return typeof sq === 'string' && /^[a-h][1-8]$/.test(sq);
}

function validatePromotion(p) {
  return !p || /^[qrbn]$/.test(p);
}

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'DELETE'],
  credentials: false
}));

// ── Auth middleware helper ─────────────────────────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  req.user = user;
  next();
}

// ── Auth routes ───────────────────────────────────────────────
app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const result = await registerUser(username, password);
  if (!result.ok) return res.status(400).json(result);
  res.status(201).json(result);
});

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const result = await loginUser(username, password);
  if (!result.ok) return res.status(401).json(result);
  res.json(result);
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  await logoutToken(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── User stats ────────────────────────────────────────────────
app.get('/api/user/stats', requireAuth, async (req, res) => {
  const stats = await getUserStats(req.user.id);
  res.json({ ok: true, ...stats });
});

// ── Game result ───────────────────────────────────────────────
app.post('/api/game/result', requireAuth, async (req, res) => {
  const { mode, result, opponent, moves, pgn } = req.body || {};
  if (!mode || !result) return res.status(400).json({ ok: false, error: 'mode and result required' });
  const validResults = ['win', 'loss', 'draw'];
  if (!validResults.includes(result)) return res.status(400).json({ ok: false, error: 'result must be win, loss, or draw' });
  const xpInfo = await saveGameResult(req.user.id, mode, result, opponent, moves, typeof pgn === 'string' ? pgn.slice(0, 8000) : null);
  res.status(201).json({ ok: true, ...xpInfo });
});

// ── Puzzles ───────────────────────────────────────────────────
const fallbackPuzzles = [
  { fen: '8/8/8/5k2/4p3/4P3/5K2/8 w - - 0 1', bestMove: 'f2e3', category: 'Endgame', elo: 1100 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 1 3', bestMove: 'e5d4', category: 'Tactical', elo: 1300 },
  { fen: 'r2q1rk1/ppp2ppp/2n2n2/3bp3/3P4/2N1PN2/PPP2PPP/R1BQ1RK1 w - - 0 9', bestMove: 'd4e5', category: 'Strategic', elo: 1600 },
];

app.get('/api/puzzles', (req, res) => {
  const count = Math.min(Number.parseInt(req.query.count || '20', 10), 100);
  res.json({ ok: true, source: 'local', puzzles: fallbackPuzzles.slice(0, count) });
});

app.post('/api/puzzle-attempts', requireAuth, async (req, res) => {
  const { puzzleId, selectedMove, expectedMove, timeSpentSec = 0 } = req.body || {};
  if (!puzzleId || !selectedMove || !expectedMove) {
    return res.status(400).json({ ok: false, error: 'Missing fields' });
  }
  const correct = String(selectedMove).trim().toLowerCase() === String(expectedMove).trim().toLowerCase();
  const xpInfo = await savePuzzleAttempt(req.user.id, puzzleId, correct, timeSpentSec);
  res.status(201).json({ ok: true, correct, ...xpInfo });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: rooms.size, db: 'postgres' });
});

app.use((_req, res) => res.status(404).end());

// ── State ─────────────────────────────────────────────────────
const rooms = new Map();              // roomCode → room
const roomsByIp = new Map();          // ip → Set of roomCodes
const socketLastMove = new Map();     // socketId → timestamp

// ── Room helpers ──────────────────────────────────────────────
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(len = 6) {
  let code = '';
  for (let i = 0; i < len; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

function createUniqueRoomCode() {
  let code = generateRoomCode();
  let attempts = 0;
  while (rooms.has(code) && attempts++ < 50) code = generateRoomCode();
  return code;
}

function toClientState(room) {
  return {
    code: room.code,
    fen: room.chess.fen(),
    turn: room.chess.turn(),
    isCheck: room.chess.isCheck(),
    isCheckmate: room.chess.isCheckmate(),
    isStalemate: room.chess.isStalemate(),
    isDraw: room.chess.isDraw(),
    players: { white: room.players.white, black: room.players.black }
  };
}

function assignColor(room) {
  if (!room.players.white) return 'white';
  if (!room.players.black) return 'black';
  return null;
}

function touchRoom(room) {
  room.lastActivity = Date.now();
}

function ipOf(socket) {
  return (
    socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() ||
    socket.handshake.address ||
    'unknown'
  );
}

function trackRoomForIp(ip, code) {
  if (!roomsByIp.has(ip)) roomsByIp.set(ip, new Set());
  roomsByIp.get(ip).add(code);
}

function untrackRoomForIp(ip, code) {
  const set = roomsByIp.get(ip);
  if (!set) return;
  set.delete(code);
  if (set.size === 0) roomsByIp.delete(ip); // clean up empty sets too
}

function roomCountForIp(ip) {
  return roomsByIp.get(ip)?.size ?? 0;
}

// ── Room expiry sweep (every 5 min) ──────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      io.to(code).emit('room:expired', { reason: 'Room expired due to inactivity' });
      // Fix: also remove from IP tracking so the per-IP limit doesn't stay inflated
      untrackRoomForIp(room.creatorIp, code);
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

// ── HTTP + Socket.IO ──────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: false
  },
  maxHttpBufferSize: 4096,
  pingTimeout: 20000,
  pingInterval: 25000,
});

// ── Socket handlers ───────────────────────────────────────────
io.on('connection', socket => {
  const ip = ipOf(socket);

  socket.on('room:create', ({ username } = {}, ack) => {
    if (roomCountForIp(ip) >= MAX_ROOMS_PER_IP) {
      ack?.({ ok: false, error: 'Too many rooms from this address' });
      return;
    }

    const name = sanitiseName(username);
    const code = createUniqueRoomCode();
    const room = {
      code,
      chess: new Chess(),
      players: {
        white: { socketId: socket.id, username: name },
        black: null
      },
      lastActivity: Date.now(),
      creatorIp: ip,        // stored so expiry sweep can clean up IP tracking
    };

    rooms.set(code, room);
    trackRoomForIp(ip, code);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.color = 'white';
    socket.data.ip = ip;

    ack?.({ ok: true, room: toClientState(room), color: 'white' });
  });

  socket.on('room:join', ({ code, username } = {}, ack) => {
    const raw = typeof code === 'string' ? code.toUpperCase().trim() : '';
    if (!ROOM_CODE_RE.test(raw)) {
      ack?.({ ok: false, error: 'Invalid room code format' });
      return;
    }

    const room = rooms.get(raw);
    if (!room) {
      ack?.({ ok: false, error: 'Room not found' });
      return;
    }

    const color = assignColor(room);
    if (!color) {
      ack?.({ ok: false, error: 'Room is full' });
      return;
    }

    const name = sanitiseName(username);
    room.players[color] = { socketId: socket.id, username: name };
    touchRoom(room);

    socket.join(raw);
    socket.data.roomCode = raw;
    socket.data.color = color;
    socket.data.ip = ip;

    const payload = { ok: true, room: toClientState(room), color };
    ack?.(payload);
    io.to(raw).emit('room:update', toClientState(room));
  });

  socket.on('game:move', ({ from, to, promotion } = {}, ack) => {
    // Rate limit
    const lastMove = socketLastMove.get(socket.id) ?? 0;
    const now = Date.now();
    if (now - lastMove < MOVE_RATE_MS) {
      ack?.({ ok: false, error: 'Moving too fast' });
      return;
    }
    socketLastMove.set(socket.id, now);

    if (!validateSquare(from) || !validateSquare(to)) {
      ack?.({ ok: false, error: 'Invalid square' });
      return;
    }
    if (!validatePromotion(promotion)) {
      ack?.({ ok: false, error: 'Invalid promotion piece' });
      return;
    }

    const roomCode = socket.data.roomCode;
    if (!roomCode) { ack?.({ ok: false, error: 'Not in a room' }); return; }

    const room = rooms.get(roomCode);
    if (!room) { ack?.({ ok: false, error: 'Room not found' }); return; }

    const color = socket.data.color;
    const turn  = room.chess.turn() === 'w' ? 'white' : 'black';
    if (color !== turn) {
      ack?.({ ok: false, error: 'Not your turn' });
      return;
    }

    // Don't accept moves on a finished game
    if (room.chess.isGameOver()) {
      ack?.({ ok: false, error: 'Game is over' });
      return;
    }

    let move;
    try {
      move = room.chess.move({ from, to, promotion: promotion || 'q' });
    } catch (error) {
      console.warn('Rejected move payload:', error?.message || error);
      ack?.({ ok: false, error: 'Invalid move' });
      return;
    }

    if (!move) {
      ack?.({ ok: false, error: 'Invalid move' });
      return;
    }

    touchRoom(room);
    const state = toClientState(room);
    io.to(roomCode).emit('game:update', { state, move });
    ack?.({ ok: true, state, move });
  });

  socket.on('disconnect', () => {
    socketLastMove.delete(socket.id);

    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    const color = socket.data.color;
    if (color === 'white') room.players.white = null;
    if (color === 'black') room.players.black = null;

    if (!room.players.white && !room.players.black) {
      // Both players gone — clean up immediately, no need to broadcast
      untrackRoomForIp(room.creatorIp, roomCode);
      rooms.delete(roomCode);
      return;
    }

    io.to(roomCode).emit('room:update', toClientState(room));
  });

  socket.on('room:forfeit', ({ code }) => {
    if (!code) return;
    // Notify the opponent that the current player forfeited
    socket.to(code).emit('game:forfeit', { winner: 'opponent', reason: 'Opponent forfeited' });
    // Clean up the room
    const room = rooms.get(code);
    if (room) {
      untrackRoomForIp(room.creatorIp, code);
      rooms.delete(code);
    }
  });
});

async function startServer() {
  await initDatabase();
  httpServer.listen(PORT, () => {
    console.log(`ARChess server listening on :${PORT}  (CORS: LAN + localhost allowed)`);
  });
}

startServer();
