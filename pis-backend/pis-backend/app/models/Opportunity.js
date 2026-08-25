const mongoose = require('mongoose');

const OpportunitySchema = new mongoose.Schema({
  tenant_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client_name:  { type: String, required: true },
  brief_text:   { type: String, required: true },

  interpreted: {
    problem_statement:    { value: String, confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    goals:                 { value: [String], confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    audience:              { value: String, confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    why_needed:            { value: String, confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    constraints:           { value: [String], confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    themes:                { value: [String], confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    pedagogical_posture:   { value: String, confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    suggested_format:      { value: String, confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    suggested_duration:    { value: String, confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    suggested_budget:      { value: String, confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },
    stakeholder_map:       { value: [{ name: String, role: String, influence: String }], confidence: Number, source: { type: String, enum: ['client_stated', 'inferred', 'assumed'] } },

    confidence_score:    Number,
    ambiguities:         [String]
  },
  logistics: {
    format: {
      primary:     String, 
      anchor_hint: String 
    },
    duration_phases: [{
      month:    String,
      days:     Number,
      modality: String
    }],
    total_days:     Number,
    hours_per_day:  Number,
    budget: {
      amount:   String,
      currency: String,
      kind:     { type: String, enum: ['stated', 'inferred', 'missing'] }
    },
    location: {
      type:       { type: String }, 
      provenance: String
    }
  },

  previous_opportunity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', default: null },
  programme_mode: { type: String, enum: ['new', 'repeat', 'new_content_same_cohort'], default: 'new' },

  questions: [{
    theme_code:     String,
    question_text:  String,
    rationale:      String,
    status:         { type: String, default: 'selected' },
    answer_text:    String,
    capture_state:  { type: String, default: 'not_asked' },

    answer_source:  { type: String, enum: ['from_brief', 'flagged_to_client', 'draft_assumption', null], default: null },

    framework_used: { type: String, default: null }
  }],

  competencies: [{
    competency_id:   String,
    competency_name: String,
    cluster:         String,
    definition:      String,
    fit_score:       Number,
    rationale:       String,
    decision:        { type: String, enum: ['accepted', 'rejected', null], default: null }
  }],

  modules: [{
    module_id:            String,
    title:                String,
    domain:               String,
    duration_hrs:         Number,
    faculty:              String,
    evidence:             String,
    nps:                  Number,
    competencies_covered: [String]  
  }],

  architecture: {
    phases:             mongoose.Schema.Types.Mixed,

    design_parameters: {
      total_duration_days: Number,
      format:               String, 
      template:             String, 
      reinforcement:        String, 
      measurement_depth:    Number, 
      audience_level:       String, 
      modality_mix: {
        sync_in_person:   Number,
        sync_virtual:     Number,
        async_self_paced: Number,
        async_social:     Number
      },
      channel_mix: {
        lecture:         Number,
        case:            Number,
        simulation:      Number,
        action_learning: Number,
        coaching:        Number,
        peer_learning:   Number,
        reflection:      Number
      }
    },

    derived_metrics: {
      competency_coverage: {
        covered: Number,
        total:   Number,
        missing: [String]
      },
      faculty_utilisation: [{
        name:  String,
        hours: Number,
        pct:   Number
      }],
      modality_actual_mix: mongoose.Schema.Types.Mixed,
      channel_actual_mix:  mongoose.Schema.Types.Mixed,
      seventy_twenty_ten: {
        formal:       Number,
        social:       Number,
        experiential: Number
      },
      warnings: [String]
    },
    rationale: {
      shape_reason:      String,
      modality_reason:   String,
      sequencing_reason: String,
      faculty_reason:    String
    }
  },

  approach_note: {
    sections: mongoose.Schema.Types.Mixed,
    version:  { type: Number, default: 1 }
  },

  
  score: {
    total:        Number,
    breakdown:    mongoose.Schema.Types.Mixed,
    gaps:         [String]
  },

  status:    { type: String, default: 'new' },
  outcome:   { type: String, enum: ['pending', 'won', 'lost'], default: 'pending' },
  due_date:  Date

}, { timestamps: true });

module.exports = mongoose.model('Opportunity', OpportunitySchema);
