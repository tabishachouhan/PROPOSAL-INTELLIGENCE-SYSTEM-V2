const mongoose = require('mongoose');

const derivedFromSchema = new mongoose.Schema(
  {
    layer: { type: String, enum: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'], required: true },
    source_field: { type: String, required: true }, // e.g. "logistics.duration_phases[1]"
    source_confidence: { type: Number, min: 0, max: 1 }
  },
  { _id: false }
);

const ELEMENT_TYPES = ['module', 'activity', 'assessment', 'coaching', 'project', 'reflection', 'break'];

const elementSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    type: { type: String, enum: ELEMENT_TYPES, required: true },
    user_locked: { type: Boolean, default: false },
    derived_from: derivedFromSchema, // absent for user-placed elements

    // type: "module"
    module_id: { type: String },
    duration_override: { type: Number },
    faculty: [String],
    pre_work: { type: String },

    // type: "activity"
    activity_kind: { type: String },
    title: { type: String },

    // type: "assessment"
    kind: { type: String },
    timing: { type: String },
    competencies_measured: [String],

    // type: "coaching"
    coach_type: { type: String },
    cadence: { type: String },

    // type: "project"
    milestone_type: { type: String },
    sponsor_involvement: { type: String },
    deliverable: { type: String },

    // type: "reflection"
    prompt: { type: String },
    modality: { type: String }, // reflection-specific modality (sync/async), distinct from Block.modality

    // type: "break" and shared duration field for activity/coaching/project
    duration: { type: Number },

    // shared free-text notes (module, activity)
    notes: { type: String }
  },
  { timestamps: false }
);

const blockSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    title: { type: String, required: true },
    start_time: { type: String }, // "09:00" — relative to the phase's local day
    duration_minutes: { type: Number, required: true },
    modality: {
      type: String,
      enum: ['sync_in_person', 'sync_virtual', 'async_self_paced', 'async_social'],
      required: true
    },
    purpose: {
      type: String,
      enum: ['foundational', 'applied', 'integrative', 'reflective', 'assessment', 'networking']
    },
    cognitive_load_band: { type: String, enum: ['low', 'mid', 'high'] },
    learning_objectives: [String],
    competencies_covered: [String],
    elements: [elementSchema]
  },
  { timestamps: false }
);

const phaseSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['pre', 'core', 'sprint', 'capstone', 'post'], required: true },
    purpose: { type: String },
    starts_relative_days: { type: Number, required: true },
    duration_days: { type: Number, required: true },
    modality: { type: String }, // phase-level default modality; blocks may override
    blocks: [blockSchema]
  },
  { timestamps: false }
);

const designParametersSchema = new mongoose.Schema(
  {
    shape: {
      total_duration_days: { type: Number },
      calendar_span_weeks: { type: Number },
      template: { type: String }
    },
    modality_mix: {
      sync_in_person: { type: Number, default: 0 },
      sync_virtual: { type: Number, default: 0 },
      async_self_paced: { type: Number, default: 0 },
      async_social: { type: Number, default: 0 }
    },
    channel_mix: {
      lecture: { type: Number, default: 0 },
      case: { type: Number, default: 0 },
      simulation: { type: Number, default: 0 },
      action_learning: { type: Number, default: 0 },
      coaching: { type: Number, default: 0 },
      peer_learning: { type: Number, default: 0 },
      reflection: { type: Number, default: 0 }
    },
    cohort: {
      total_size: { type: Number },
      tracks: [String],
      track_split_rule: { type: String }
    },
    reinforcement: { type: String, enum: ['light', 'medium', 'heavy'] },
    measurement_depth: { type: Number, enum: [1, 2, 3, 4] },
    sponsor_involvement: [{ type: String, enum: ['kickoff', 'milestones', 'capstone', 'coach'] }]
  },
  { _id: false }
);

const derivedMetricsSchema = new mongoose.Schema(
  {
    competency_coverage: {
      covered: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      missing: [String]
    },
    cognitive_load_profile: mongoose.Schema.Types.Mixed, 
    modality_actual_mix: mongoose.Schema.Types.Mixed,
    channel_actual_mix: mongoose.Schema.Types.Mixed,
    faculty_utilisation: [
      {
        name: String,
        hours: Number,
        pct: Number
      }
    ],
    seventy_twenty_ten_ratio: {
      formal: Number,
      social: Number,
      experiential: Number
    },
    bloom_arc: [String], 
    transfer_score: { type: Number } 
  },
  { _id: false }
);

const rationaleSchema = new mongoose.Schema(
  {
    shape_reason: { type: String },
    modality_reason: { type: String },
    sequencing_reason: { type: String },
    faculty_reason: { type: String }
  },
  { _id: false }
);

const programmeSchema = new mongoose.Schema(
  {
    opportunity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    version: { type: Number, default: 1 },
    status: { type: String, enum: ['draft', 'in-review', 'locked', 'revised'], default: 'draft', index: true },
    revised_from_version: { type: Number, default: null },

    name: { type: String },
    format: { type: String, enum: ['residential', 'virtual', 'hybrid', 'modular'] },
    total_duration_days: { type: Number },
    calendar_span_weeks: { type: Number },
    cohort_size: { type: Number },
    cohorts: [String],

    design_parameters: designParametersSchema,
    derived_metrics: derivedMetricsSchema,
    rationale: rationaleSchema,

    phases: [phaseSchema],

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

programmeSchema.index({ opportunity_id: 1, status: 1 });

module.exports = mongoose.model('Programme', programmeSchema);
