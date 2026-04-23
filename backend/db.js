// db.js — SQLite via built-in node:sqlite (Node 24+)
import { DatabaseSync } from 'node:sqlite';
import { compareSync, hashSync } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'archess.sqlite');

let db = null;

// ── XP / Level helpers ────────────────────────────────────────
const XP_PER_LEVEL = 100;
const MAX_LEVEL    = 50;

function calcLevel(xp) {
  return Math.min(MAX_LEVEL, 1 + Math.floor(xp / XP_PER_LEVEL));
}

function xpToNextLevel(xp) {
  const lvl = calcLevel(xp);
  if (lvl >= MAX_LEVEL) return 0;
  return XP_PER_LEVEL - (xp % XP_PER_LEVEL);
}

export function initDatabase() {
  db = new DatabaseSync(DB_PATH);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT    NOT NULL,
      xp            INTEGER NOT NULL DEFAULT 0,
      level         INTEGER NOT NULL DEFAULT 1,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT    PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_results (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode        TEXT    NOT NULL,
      result      TEXT    NOT NULL,
      opponent    TEXT,
      moves       INTEGER NOT NULL DEFAULT 0,
      pgn         TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS puzzle_attempts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      puzzle_id      TEXT    NOT NULL,
      correct        INTEGER NOT NULL DEFAULT 0,
      time_spent_sec INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Safe migrations for existing databases (no-op if column already exists)
  for (const sql of [
    'ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN level INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE game_results ADD COLUMN pgn TEXT',
  ]) {
    try { db.exec(sql); } catch (_) {}
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry  ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_game_user        ON game_results(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_puzzle_user      ON puzzle_attempts(user_id);
  `);

  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));

  setInterval(() => {
    try {
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
    } catch (_) {}
  }, 60 * 60 * 1000);

  console.log(`SQLite ready: ${DB_PATH}`);
  return db;
}

// ── Auth ──────────────────────────────────────────────────────

export function registerUser(username, password) {
  if (!username || !password) return { ok: false, error: 'Username and password required' };
  if (username.trim().length < 2) return { ok: false, error: 'Username must be at least 2 characters' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters' };
  const hash = hashSync(password, 12);
  try {
    const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username.trim(), hash);
    const token = _createSession(info.lastInsertRowid);
    return { ok: true, userId: info.lastInsertRowid, username: username.trim(), token, xp: 0, level: 1 };
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return { ok: false, error: 'Username already taken' };
    throw err;
  }
}

export function loginUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username?.trim());
  if (!user || !compareSync(password, user.password_hash)) {
    return { ok: false, error: 'Invalid username or password' };
  }
  const token = _createSession(user.id);
  return { ok: true, token, userId: user.id, username: user.username, xp: user.xp || 0, level: user.level || 1 };
}

export function getUserFromToken(token) {
  if (!token) return null;
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?')
    .get(token, Math.floor(Date.now() / 1000));
  if (!session) return null;
  return db.prepare('SELECT id, username, xp, level, created_at FROM users WHERE id = ?').get(session.user_id);
}

export function logoutToken(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function _createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

// ── XP award ─────────────────────────────────────────────────

export function awardXp(userId, amount) {
  const user = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  const prevLevel = user.level || 1;
  const newXp    = (user.xp || 0) + amount;
  const newLevel = calcLevel(newXp);
  db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXp, newLevel, userId);
  return {
    xp_gained:  amount,
    new_xp:     newXp,
    new_level:  newLevel,
    leveled_up: newLevel > prevLevel,
    xp_to_next: xpToNextLevel(newXp),
  };
}

// ── Records ───────────────────────────────────────────────────

export function saveGameResult(userId, mode, result, opponent, moves, pgn) {
  db.prepare('INSERT INTO game_results (user_id, mode, result, opponent, moves, pgn) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, mode, result, opponent || null, moves || 0, pgn || null);
  const XP_MAP = { win: 50, draw: 25, loss: 10 };
  return awardXp(userId, XP_MAP[result] ?? 10);
}

export function savePuzzleAttempt(userId, puzzleId, correct, timeSpentSec) {
  db.prepare('INSERT INTO puzzle_attempts (user_id, puzzle_id, correct, time_spent_sec) VALUES (?, ?, ?, ?)')
    .run(userId, puzzleId, correct ? 1 : 0, timeSpentSec || 0);
  return awardXp(userId, correct ? 20 : 2);
}

export function getUserStats(userId) {
  const user = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(userId);
  const games = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN result='win'  THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN result='draw' THEN 1 ELSE 0 END) AS draws
    FROM game_results WHERE user_id = ?
  `).get(userId);
  const puzzles = db.prepare(`
    SELECT COUNT(*) AS total, SUM(correct) AS correct
    FROM puzzle_attempts WHERE user_id = ?
  `).get(userId);
  const recentGames = db.prepare(`
    SELECT mode, result, opponent, moves, pgn, created_at
    FROM game_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(userId);
  return {
    xp:     user?.xp    ?? 0,
    level:  user?.level ?? 1,
    xp_to_next: xpToNextLevel(user?.xp ?? 0),
    games,
    puzzles,
    recentGames,
  };
}
