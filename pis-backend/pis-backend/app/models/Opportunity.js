const mongoose = require('mongoose');

const OpportunitySchema = new mongoose.Schema({
  tenant_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client_name:  { type: String, required: true },
  brief_text:   { type: String, required: true },

  // Agent 1 output — Brief Interpreter
  // Every substantive field is stored as { value, confidence, source } so the
  // page can show per-section confidence and whether the AI got it directly
  // from the client, inferred it, or is falling back to a standard assumption.
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

    // These two stay plain — they describe the brief overall, not a single
    // extracted fact, so a per-field confidence/source doesn't apply to them.
    confidence_score:    Number,
    ambiguities:         [String]
  },

  // Structured logistics — captured directly from the New Opportunity form,
  // not inferred by AI. Distinct from interpreted.suggested_format/
  // suggested_duration/suggested_budget, which are the AI's own guesses;
  // this is what the BD Manager actually selected on the form.
  logistics: {
    format: {
      primary:     String, // 'blended' | 'vilt' | 'async' | 'on-campus'
      anchor_hint: String  // 'residential-anchor' | 'distributed-hybrid' | 'modular'
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
      type:       String, // 'client-site' | 'offsite' | 'institution-campus' | 'third-party-venue'
      provenance: String
    }
  },

  // Links this opportunity to a prior one, for Repeat / Same-Cohort modes.
  // Set explicitly by the BD Manager on the New Opportunity page — never
  // inferred automatically.
  previous_opportunity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', default: null },
  programme_mode: { type: String, enum: ['new', 'repeat', 'new_content_same_cohort'], default: 'new' },

  // Agent 2 output — Question Generator
  questions: [{
    theme_code:     String,
    question_text:  String,
    rationale:      String,
    status:         { type: String, default: 'selected' },
    answer_text:    String,
    capture_state:  { type: String, default: 'not_asked' },

    // ── answer-source tracking ────────────────
    // 'from_brief'        -> Option 1: answer pulled from client requirement doc
    // 'flagged_to_client' -> Option 2: not in brief, needs to go back to client
    // 'draft_assumption'  -> Option 3: AI-drafted assumption / first-draft answer
    answer_source:  { type: String, enum: ['from_brief', 'flagged_to_client', 'draft_assumption', null], default: null },

    // ── framework tagging ──
    framework_used: { type: String, default: null }
  }],

  // Agent 3 output — Competency Mapper
  competencies: [{
    competency_id:   String,
    competency_name: String,
    cluster:         String,
    definition:      String,
    fit_score:       Number,
    rationale:       String,
    // 'accepted' | 'rejected' | null (undecided — treated as accepted by
    // default downstream, since most mapped competencies are expected to
    // be kept unless the BD Manager actively rejects one)
    decision:        { type: String, enum: ['accepted', 'rejected', null], default: null }
  }],

  // Agent 4 output — Module Recommender
  modules: [{
    module_id:            String,
    title:                String,
    domain:               String,
    duration_hrs:         Number,
    faculty:              String,
    evidence:             String,
    nps:                  Number,
    competencies_covered: [String]  // which of the accepted competencies this
                                     // specific module covers — set by Agent 4,
                                     // used by Architecture's coverage check
  }],

  // Agent 5 output — Architecture Builder
  architecture: {
    phases:             mongoose.Schema.Types.Mixed,

    // ── Design parameters used to generate this architecture ──
    // Either inferred automatically (first generation) or set by the
    // BD Manager and passed in on a regenerate call.
    design_parameters: {
      total_duration_days: Number,
      format:               String, // 'residential' | 'hybrid' | 'virtual' | 'modular'
      template:             String, // 'intensive_1d' | 'intensive_3d' | 'residential_5d' | 'hybrid_sprint' | 'modular_monthly'
      reinforcement:        String, // 'light' | 'medium' | 'heavy'
      measurement_depth:    Number  // 1-4
    },

    // ── Deterministic, code-computed metrics — separate from the LLM's own
    // self-reported "validation" field, which is kept only as a hint ──
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
      warnings: [String]
    },

    // ── Short LLM-written explanation of the design choices, shown to the BD Manager ──
    rationale: {
      shape_reason:      String,
      sequencing_reason: String
    }
  },

  // Agent 6 output — Approach Note Writer
  approach_note: {
    sections: mongoose.Schema.Types.Mixed,
    version:  { type: Number, default: 1 }
  },

  // Proposal scoring
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
