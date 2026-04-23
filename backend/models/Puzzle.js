import mongoose from 'mongoose';

const PuzzleSchema = new mongoose.Schema({
  fen: { type: String, required: true },
  bestMove: { type: String, required: true },
  category: { type: String, enum: ['Tactical', 'Strategic', 'Endgame'], required: true },
  elo: { type: Number, min: 800, max: 3200, required: true },
  source: { type: String, default: 'seed' },
}, { timestamps: true });

export const Puzzle = mongoose.models.Puzzle || mongoose.model('Puzzle', PuzzleSchema);
