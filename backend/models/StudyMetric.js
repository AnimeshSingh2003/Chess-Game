import mongoose from 'mongoose';

const StudyMetricSchema = new mongoose.Schema({
  participantId: { type: String, required: true },
  mode: { type: String, enum: ['pvp', 'pvai', 'puzzle', 'ar'], required: true },
  sessionDurationSec: { type: Number, min: 0, default: 0 },
  taskCompletion: { type: Boolean, default: false },
  susScore: { type: Number, min: 0, max: 100 },
  nasaTlx: { type: Number, min: 0, max: 100 },
  spatialScoreDeltaPct: { type: Number },
  deviceType: { type: String, default: 'unknown' },
}, { timestamps: true });

export const StudyMetric = mongoose.models.StudyMetric || mongoose.model('StudyMetric', StudyMetricSchema);
