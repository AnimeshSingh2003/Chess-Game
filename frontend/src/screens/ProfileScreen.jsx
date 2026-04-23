import React from 'react';

export default function ProfileScreen({ playerName, userXp, userLevel, xpProgress, xpToNext, stats }) {
  return (
    <section className="glass-panel panel">
      <h3>Profile — {playerName}</h3>

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
        <p className="muted">Could not load stats — check connection</p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span className="stat-num">{stats.games?.total ?? 0}</span><span className="stat-label">Games</span></div>
            <div className="stat-card green"><span className="stat-num">{stats.games?.wins ?? 0}</span><span className="stat-label">Wins</span></div>
            <div className="stat-card red"><span className="stat-num">{stats.games?.losses ?? 0}</span><span className="stat-label">Losses</span></div>
            <div className="stat-card yellow"><span className="stat-num">{stats.games?.draws ?? 0}</span><span className="stat-label">Draws</span></div>
            <div className="stat-card blue"><span className="stat-num">{stats.puzzles?.total ?? 0}</span><span className="stat-label">Puzzles</span></div>
            <div className="stat-card cyan">
              <span className="stat-num">
                {stats.puzzles?.total
                  ? Math.round((stats.puzzles.correct / stats.puzzles.total) * 100)
                  : 0}%
              </span>
              <span className="stat-label">Accuracy</span>
            </div>
          </div>

          {stats.recentGames?.length > 0 && (
            <>
              <h4 style={{ marginTop: 12 }}>Recent Games</h4>
              <div className="recent-list">
                {stats.recentGames.map((g, i) => (
                  <div key={i} className={`recent-row result-${g.result}`}>
                    <span className="recent-mode">{g.mode.toUpperCase()}</span>
                    <span className={`recent-result ${g.result}`}>{g.result.toUpperCase()}</span>
                    {g.opponent && <span className="recent-opp">vs {g.opponent}</span>}
                    <span className="recent-moves">{g.moves} moves</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
