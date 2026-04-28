import React from 'react';

const MODE_LABELS = { pvp: 'Local PvP', pvai: 'vs AI', 'pvp-online': 'Online', puzzle: 'Puzzle', ar: 'AR' };

export default function ProfileScreen({ playerName, userXp, userLevel, xpProgress, xpToNext, stats, onLoadStats }) {
  const winRate = stats?.games?.total
    ? Math.round((stats.games.wins / stats.games.total) * 100)
    : 0;
  const puzzleAcc = stats?.puzzles?.total
    ? Math.round((stats.puzzles.correct / stats.puzzles.total) * 100)
    : 0;

  return (
    <section className="glass-panel panel">
      <div className="profile-header">
        <div className="profile-avatar">{playerName.slice(0, 2).toUpperCase()}</div>
        <div>
          <h3 className="profile-name">{playerName}</h3>
          <span className="level-badge profile-level-badge">Level {userLevel}</span>
        </div>
      </div>

      {/* XP bar */}
      <div className="profile-level-card glass-card">
        <div className="profile-level-top">
          <span className="level-big">Level {userLevel}</span>
          <span className="xp-total">{userXp} XP total</span>
        </div>
        <div className="profile-xp-bar">
          <div className="profile-xp-fill" style={{ width: `${xpProgress}%` }} />
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>{xpToNext} XP to next level</p>
      </div>

      {stats === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
          <div className="splash-spinner" style={{ width: 36, height: 36 }} />
        </div>
      ) : !stats ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <p className="muted">Could not load stats</p>
          <button className="ctrl-btn" style={{ marginTop: 8 }} onClick={onLoadStats}>Retry</button>
        </div>
      ) : (
        <>
          {/* Win rate highlight */}
          <div className="winrate-banner glass-card">
            <div className="winrate-circle">
              <span className="winrate-pct">{winRate}%</span>
              <span className="winrate-label">Win Rate</span>
            </div>
            <div className="winrate-breakdown">
              <span className="wr-item green">✓ {stats.games?.wins ?? 0} Wins</span>
              <span className="wr-item red">✗ {stats.games?.losses ?? 0} Losses</span>
              <span className="wr-item yellow">½ {stats.games?.draws ?? 0} Draws</span>
              <span className="wr-item blue">∑ {stats.games?.total ?? 0} Total</span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="stats-grid">
            <div className="stat-card blue">
              <span className="stat-num">{stats.puzzles?.total ?? 0}</span>
              <span className="stat-label">Puzzles</span>
            </div>
            <div className="stat-card cyan">
              <span className="stat-num">{puzzleAcc}%</span>
              <span className="stat-label">Puzzle Acc.</span>
            </div>
            <div className="stat-card purple">
              <span className="stat-num">{stats.games?.total ?? 0}</span>
              <span className="stat-label">Games</span>
            </div>
            <div className="stat-card green">
              <span className="stat-num">{winRate}%</span>
              <span className="stat-label">Win %</span>
            </div>
          </div>

          {/* Recent games */}
          {stats.recentGames?.length > 0 ? (
            <>
              <h4 style={{ marginTop: 14, marginBottom: 6 }}>Recent Games</h4>
              <div className="recent-list">
                {stats.recentGames.map((g, i) => (
                  <div key={i} className={`recent-row result-${g.result}`}>
                    <span className="recent-mode">{MODE_LABELS[g.mode] || g.mode.toUpperCase()}</span>
                    <span className={`recent-result ${g.result}`}>{g.result.toUpperCase()}</span>
                    {g.opponent && <span className="recent-opp">vs {g.opponent}</span>}
                    <span className="recent-moves">{g.moves} moves</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}>No games recorded yet — play a game to see history!</p>
          )}
        </>
      )}
    </section>
  );
}
