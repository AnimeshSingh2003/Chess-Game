// db.js — PostgreSQL via node-postgres (pg)
// Compatible with Supabase (free tier) and any Postgres provider
import pg from 'pg';
import { compareSync, hashSync } from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

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

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            BIGSERIAL PRIMARY KEY,
      username      TEXT      UNIQUE NOT NULL,
      password_hash TEXT      NOT NULL,
      xp            INTEGER   NOT NULL DEFAULT 0,
      level         INTEGER   NOT NULL DEFAULT 1,
      created_at    BIGINT    NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT   PRIMARY KEY,
      user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at  BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_results (
      id          BIGSERIAL PRIMARY KEY,
      user_id     BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode        TEXT    NOT NULL,
      result      TEXT    NOT NULL,
      opponent    TEXT,
      moves       INTEGER NOT NULL DEFAULT 0,
      pgn         TEXT,
      created_at  BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    CREATE TABLE IF NOT EXISTS puzzle_attempts (
      id             BIGSERIAL PRIMARY KEY,
      user_id        BIGINT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      puzzle_id      TEXT     NOT NULL,
      correct        SMALLINT NOT NULL DEFAULT 0,
      time_spent_sec INTEGER  NOT NULL DEFAULT 0,
      created_at     BIGINT   NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_game_user       ON game_results(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_puzzle_user     ON puzzle_attempts(user_id);
  `);

  // Safe column additions (Postgres IF NOT EXISTS)
  for (const sql of [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE game_results ADD COLUMN IF NOT EXISTS pgn TEXT',
  ]) {
    await pool.query(sql).catch(() => {});
  }

  await pool.query('DELETE FROM sessions WHERE expires_at < $1', [Math.floor(Date.now() / 1000)]);

  setInterval(async () => {
    await pool.query('DELETE FROM sessions WHERE expires_at < $1', [Math.floor(Date.now() / 1000)]).catch(() => {});
  }, 60 * 60 * 1000);

  console.log('PostgreSQL (Supabase) ready');
  return pool;
}

// ── Auth ──────────────────────────────────────────────────────

export async function registerUser(username, password) {
  if (!username || !password) return { ok: false, error: 'Username and password required' };
  if (username.trim().length < 2) return { ok: false, error: 'Username must be at least 2 characters' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters' };
  const hash = hashSync(password, 12);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES (LOWER($1), $2) RETURNING id',
      [username.trim(), hash]
    );
    const token = await _createSession(rows[0].id);
    return { ok: true, userId: rows[0].id, username: username.trim(), token, xp: 0, level: 1 };
  } catch (err) {
    if (String(err.message).includes('unique') || String(err.code) === '23505') {
      return { ok: false, error: 'Username already taken' };
    }
    throw err;
  }
}

export async function loginUser(username, password) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE username = LOWER($1)',
    [username?.trim()]
  );
  const user = rows[0];
  if (!user || !compareSync(password, user.password_hash)) {
    return { ok: false, error: 'Invalid username or password' };
  }
  const token = await _createSession(user.id);
  return { ok: true, token, userId: user.id, username: user.username, xp: user.xp || 0, level: user.level || 1 };
}

export async function getUserFromToken(token) {
  if (!token) return null;
  const { rows: sessionRows } = await pool.query(
    'SELECT user_id FROM sessions WHERE token = $1 AND expires_at > $2',
    [token, Math.floor(Date.now() / 1000)]
  );
  if (!sessionRows[0]) return null;
  const { rows } = await pool.query(
    'SELECT id, username, xp, level, created_at FROM users WHERE id = $1',
    [sessionRows[0].user_id]
  );
  return rows[0] ?? null;
}

export async function logoutToken(token) {
  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

async function _createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  await pool.query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt]
  );
  return token;
}

// ── XP award ─────────────────────────────────────────────────

export async function awardXp(userId, amount) {
  const { rows } = await pool.query('SELECT xp, level FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user) return null;
  const prevLevel = user.level || 1;
  const newXp    = (user.xp || 0) + amount;
  const newLevel = calcLevel(newXp);
  await pool.query('UPDATE users SET xp = $1, level = $2 WHERE id = $3', [newXp, newLevel, userId]);
  return {
    xp_gained:  amount,
    new_xp:     newXp,
    new_level:  newLevel,
    leveled_up: newLevel > prevLevel,
    xp_to_next: xpToNextLevel(newXp),
  };
}

// ── Records ───────────────────────────────────────────────────

export async function saveGameResult(userId, mode, result, opponent, moves, pgn) {
  await pool.query(
    'INSERT INTO game_results (user_id, mode, result, opponent, moves, pgn) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, mode, result, opponent || null, moves || 0, pgn || null]
  );
  const XP_MAP = { win: 50, draw: 25, loss: 10 };
  return awardXp(userId, XP_MAP[result] ?? 10);
}

export async function savePuzzleAttempt(userId, puzzleId, correct, timeSpentSec) {
  await pool.query(
    'INSERT INTO puzzle_attempts (user_id, puzzle_id, correct, time_spent_sec) VALUES ($1, $2, $3, $4)',
    [userId, puzzleId, correct ? 1 : 0, timeSpentSec || 0]
  );
  return awardXp(userId, correct ? 20 : 2);
}

export async function getUserStats(userId) {
  const [userRes, gamesRes, puzzlesRes, recentRes] = await Promise.all([
    pool.query('SELECT xp, level FROM users WHERE id = $1', [userId]),
    pool.query(`
      SELECT COUNT(*)::INT AS total,
        SUM(CASE WHEN result='win'  THEN 1 ELSE 0 END)::INT AS wins,
        SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END)::INT AS losses,
        SUM(CASE WHEN result='draw' THEN 1 ELSE 0 END)::INT AS draws
      FROM game_results WHERE user_id = $1
    `, [userId]),
    pool.query(`
      SELECT COUNT(*)::INT AS total, SUM(correct)::INT AS correct
      FROM puzzle_attempts WHERE user_id = $1
    `, [userId]),
    pool.query(`
      SELECT mode, result, opponent, moves, pgn, created_at
      FROM game_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
    `, [userId]),
  ]);
  const user = userRes.rows[0];
  return {
    xp:     user?.xp    ?? 0,
    level:  user?.level ?? 1,
    xp_to_next: xpToNextLevel(user?.xp ?? 0),
    games:       gamesRes.rows[0],
    puzzles:     puzzlesRes.rows[0],
    recentGames: recentRes.rows,
  };
}
