const mongoose = require('mongoose');

const programmeVersionSchema = new mongoose.Schema(
  {
    programme_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Programme', required: true, index: true },
    opportunity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    version: { type: Number, required: true },
    label: { type: String }, // optional user-given name, e.g. "Option A"
    reason: { type: String, enum: ['snapshot', 'lock'], required: true },

    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

programmeVersionSchema.index({ programme_id: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('ProgrammeVersion', programmeVersionSchema);
