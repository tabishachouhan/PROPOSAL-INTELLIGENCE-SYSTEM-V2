const mongoose = require('mongoose');

// One document = one question's state for one opportunity.
// We upsert on (opportunityId, questionId) instead of nesting answers
// inside the Opportunity doc — keeps writes small and avoids fighting
// Mongoose over deeply nested array updates.

const foundInSourceSchema = new mongoose.Schema(
  {
    attachmentId: { type: mongoose.Schema.Types.ObjectId },
    extractedTextRef: { type: String },
  },
  { _id: false }
);

const discoveryAnswerSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: true,
      index: true,
    },
    questionId: { type: String, required: true }, // e.g. "BCS-01", owned by Member B's template manager
    themeCode: { type: String, required: true }, // BCS, AUD, BAS, etc.

    status: {
      type: String,
      enum: ['pending', 'answered', 'skipped_by_rule', 'system_confirmed'],
      default: 'pending',
    },

    // Free-form on purpose — some questions take short text, others take
    // structured picks (arrays, small objects). Validate shape at the
    // controller level per question type rather than locking the schema down.
    value: mongoose.Schema.Types.Mixed,

    // Why a question got skipped/confirmed instead of asked — usually the
    // rule from Member B's suppression engine, kept here for auditability.
    skipReason: { type: String },
    foundInSource: foundInSourceSchema,

    answeredBy: { type: String, enum: ['user', 'system'], default: 'user' },
  },
  { timestamps: true }
);

discoveryAnswerSchema.index({ opportunityId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('DiscoveryAnswer', discoveryAnswerSchema);
