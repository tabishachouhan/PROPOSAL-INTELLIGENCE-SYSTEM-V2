const mongoose = require('mongoose');

// A standalone, append-only log — deliberately NOT embedded on Opportunity,
// per the spec's own reasoning: it needs to answer "why didn't the system
// ask about X?" even after the question itself has been edited or deleted,
// and it should outlive any single generation run.
const SuppressionAuditSchema = new mongoose.Schema({
  opportunity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  tenant_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  question_theme:           String,
  question_text_candidate:  String,
  suppression_reason:       String,
  page1_field_path:         String,
  page1_provenance:         String,
  page1_confidence:         Number,

}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('SuppressionAudit', SuppressionAuditSchema);