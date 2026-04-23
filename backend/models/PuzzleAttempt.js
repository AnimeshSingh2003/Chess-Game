import mongoose from 'mongoose';

const PuzzleAttemptSchema = new mongoose.Schema({
  participantId: { type: String, required: true },
  puzzleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Puzzle', required: true },
  selectedMove: { type: String, required: true },
  expectedMove: { type: String, required: true },
  correct: { type: Boolean, required: true },
  timeSpentSec: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

export const PuzzleAttempt = mongoose.models.PuzzleAttempt || mongoose.model('PuzzleAttempt', PuzzleAttemptSchema);
