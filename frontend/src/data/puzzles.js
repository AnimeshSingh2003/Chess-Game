const BASE_PUZZLES = [
  { fen: 'r5k1/pp3pbp/2p3p1/4p3/3P4/2N2Q2/PPP2PPP/R1B2RK1 w - - 0 1', bestMove: 'Qxf7+', category: 'Tactical', elo: 1200 },
  { fen: '6k1/5ppp/1p6/p1p5/P1P5/2P2N2/5PPP/6K1 w - - 0 1', bestMove: 'Kf1', category: 'Endgame', elo: 1300 },
  { fen: '2r2rk1/1bq1bppp/p2ppn2/1p6/3NP3/1BN1B3/PPQ2PPP/2RR2K1 w - - 0 1', bestMove: 'f3', category: 'Strategic', elo: 1400 },
  { fen: 'r1bq1rk1/pppn1ppp/3b4/3Pp3/2B1P3/2N5/PPP2PPP/R1BQ1RK1 w - - 0 1', bestMove: 'Bg5', category: 'Tactical', elo: 1450 },
  { fen: '8/2p5/1p2k3/p1p5/P1P1K3/1P6/8/8 w - - 0 1', bestMove: 'Kd5', category: 'Endgame', elo: 1500 },
  { fen: 'r2q1rk1/pp2bppp/2n1pn2/2bp4/3P4/2N1PN2/PPQ1BPPP/R1BR2K1 w - - 0 1', bestMove: 'dxc5', category: 'Strategic', elo: 1550 },
  { fen: '5rk1/pp4pp/2p1q3/3pP3/3P4/1Q6/PP3PPP/4R1K1 w - - 0 1', bestMove: 'Qb4', category: 'Tactical', elo: 1600 },
  { fen: 'r4rk1/1pp2pp1/p1np1q1p/4p3/2P1P3/1PN1BP2/PB3QPP/R4RK1 w - - 0 1', bestMove: 'Qd2', category: 'Strategic', elo: 1650 },
  { fen: '8/8/4k3/8/4K3/8/3P4/8 w - - 0 1', bestMove: 'd4', category: 'Endgame', elo: 1000 },
  { fen: 'r1b2rk1/ppq2ppp/2n1pn2/2bp4/3P4/2N1PN2/PPQ1BPPP/R1BR2K1 w - - 0 1', bestMove: 'Nb5', category: 'Tactical', elo: 1700 },
  { fen: '2r2rk1/pp1q1pp1/2n1bn1p/2bp4/3P4/1PN1PN2/PBQ1BPPP/2RR2K1 w - - 0 1', bestMove: 'dxc5', category: 'Strategic', elo: 1750 },
  { fen: '8/5pk1/6p1/4P2p/7P/5PK1/8/8 w - - 0 1', bestMove: 'Kf4', category: 'Endgame', elo: 1350 }
];

function buildPuzzleBank(total = 540) {
  const bank = [];
  for (let i = 0; i < total; i += 1) {
    const base = BASE_PUZZLES[i % BASE_PUZZLES.length];
    bank.push({
      id: i + 1,
      fen: base.fen,
      bestMove: base.bestMove,
      category: base.category,
      elo: base.elo + Math.floor(i / BASE_PUZZLES.length) * 2,
    });
  }
  return bank;
}

export const PUZZLES = buildPuzzleBank();
