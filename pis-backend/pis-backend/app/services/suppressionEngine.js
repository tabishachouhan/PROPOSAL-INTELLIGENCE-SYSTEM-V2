// ── DISCOVERY QUESTIONS: SUPPRESSION ENGINE ──────────
// Pure, deterministic logic — no LLM calls. Reads the context payload from
// questionsContextService.js and decides, per candidate question, whether
// to suppress it, downgrade it to a confirmation/targeted variant, or
// retain it as a fully open question. Matches spec Section 7.

const { getQuestionSet } = require('../data/discoveryQuestionBank');

// ── The 8 New Programme baseline candidates, pulled from the real
// question bank (Task B.2) instead of bare placeholder titles ──
const NEW_PROGRAMME_CANDIDATES = getQuestionSet('new').map(q => ({
  id: q.id,
  theme_code: q.theme_code,
  title: q.question_text,
}));

// ── Generic default rule, per Section 7.1 ──
// client_stated + confidence >= 80  -> suppress
// inferred + confidence >= 65       -> downgrade to confirmation
// inferred < 65, or assumed         -> retain, open, first-draft pre-filled
// field missing                     -> retain, open, no pre-fill
const applyGenericRule = (field) => {
  if (!field || field.value === undefined || field.value === null || (Array.isArray(field.value) && field.value.length === 0)) {
    return { decision: 'retained', variant: 'open', prefill: false, reason: 'Field missing or empty on Page 1' };
  }
  if (field.source === 'client_stated' && field.confidence >= 80) {
    return { decision: 'suppressed', reason: `client_stated at ${field.confidence}% confidence` };
  }
  if (field.source === 'inferred' && field.confidence >= 65) {
    return { decision: 'downgraded', variant: 'confirmation', prefill: true, reason: `inferred at ${field.confidence}% confidence` };
  }
  return { decision: 'retained', variant: 'open', prefill: true, reason: `${field.source} at ${field.confidence}% confidence, below threshold` };
};

// ── Per-question overrides, per Section 7.2's table ──
// Each override receives the full context and returns a decision, or null
// to fall through to applyGenericRule on a specific field.
const QUESTION_RULES = {
  // Q1: only suppress if the problem_statement names a specific event —
  // approximated here as "client_stated at very high confidence", since we
  // don't have a named-entity extractor. Flagged as an approximation.
  Q1: (ctx) => {
    const field = ctx.brief_interpretation.problem_statement;
    if (field?.source === 'client_stated' && field.confidence >= 80) {
      return { decision: 'suppressed', reason: 'problem_statement client_stated at high confidence (approximates "names a specific event")' };
    }
    return applyGenericRule(field);
  },

  // Q2: never suppressed, per spec explicitly.
  Q2: () => ({ decision: 'retained', variant: 'open', prefill: false, reason: 'Politics are never captured on Page 1 (spec: never suppressed)' }),

  // Q3: our schema has no prior_exposure field yet (a known gap versus the
  // spec, which assumes one). Always retained until that field exists.
  Q3: () => ({ decision: 'retained', variant: 'open', prefill: false, reason: 'No prior_exposure field captured yet (schema gap, not a suppression decision)' }),

  // Q4: downgrade (never fully suppress) if goals are client_stated at high confidence.
  Q4: (ctx) => {
    const field = ctx.brief_interpretation.goals;
    if (field?.source === 'client_stated' && field.confidence >= 80) {
      return { decision: 'downgraded', variant: 'targeted', prefill: true, reason: 'goals client_stated at high confidence' };
    }
    return { decision: 'retained', variant: 'open', prefill: field?.value?.length > 0, reason: 'Behaviour-level detail always needed regardless of goal clarity' };
  },

  // Q5: suppress only in same-cohort mode, with a strong previous NPS.
  Q5: (ctx) => {
    if (ctx.programme_kind === 'new_content_same_cohort' && ctx.previous_cohort_context?.previous_nps >= 8) {
      return { decision: 'suppressed', reason: `Same-Cohort mode with previous NPS ${ctx.previous_cohort_context.previous_nps} >= 8.0` };
    }
    return { decision: 'retained', variant: 'open', prefill: false, reason: 'No faculty-style signal on Page 1' };
  },

  // Q6: never suppressed, per spec explicitly.
  Q6: () => ({ decision: 'retained', variant: 'open', prefill: false, reason: 'Exclusion knowledge is never volunteered (spec: never suppressed)' }),

  // Q7: downgrade to a per-stakeholder variant if 3+ named stakeholders exist.
  Q7: (ctx) => {
    const stakeholders = ctx.brief_interpretation.stakeholder_map || [];
    if (stakeholders.length >= 3) {
      return { decision: 'downgraded', variant: 'targeted', prefill: true, reason: `stakeholder_map has ${stakeholders.length} named people` };
    }
    return { decision: 'retained', variant: 'open', prefill: stakeholders.length > 0, reason: 'Fewer than 3 named stakeholders' };
  },

  // Q8: never suppressed, per spec explicitly.
  Q8: () => ({ decision: 'retained', variant: 'open', prefill: false, reason: 'Measurement plans are rarely documented (spec: never suppressed)' }),
};

// ── Run the full engine for one opportunity context ──
// Returns { questions: [...], suppressed_count, audit: [...] } where audit
// is ready to be written straight into SuppressionAudit rows by the route.
const runSuppressionEngine = (context) => {
  // Repeat and Same-Cohort modes are NOT run through suppression at all —
  // per spec, Sections 5 and 6 define fixed baselines with no pruning logic.
  if (context.programme_kind !== 'new') {
    return { applies: false, questions: [], suppressed_count: 0, audit: [] };
  }

  const audit = [];
  const questions = [];

  NEW_PROGRAMME_CANDIDATES.forEach((candidate) => {
    const rule = QUESTION_RULES[candidate.id];
    const result = rule(context);

    audit.push({
      question_theme: candidate.theme_code,
      question_text_candidate: candidate.title,
      suppression_reason: result.reason,
      page1_field_path: null, // filled in by caller if a specific field drove the decision
      page1_provenance: null,
      page1_confidence: null,
    });

    if (result.decision === 'suppressed') return; // dropped entirely, not added to `questions`

    const fullQuestion = getQuestionSet('new').find(q => q.id === candidate.id);
    questions.push({
      candidate_id: candidate.id,
      theme_code: candidate.theme_code,
      question_text: fullQuestion.question_text,
      rationale: fullQuestion.rationale,
      downstream_use: fullQuestion.downstream_use,
      essentiality: result.decision === 'downgraded' ? 'confirmation' : 'essential',
      variant: result.variant,
      prefill: !!result.prefill,
      suppression_reason: result.decision === 'downgraded' ? result.reason : null,
    });
  });

  return {
    applies: true,
    questions,
    suppressed_count: NEW_PROGRAMME_CANDIDATES.length - questions.length,
    audit,
  };
};

module.exports = { runSuppressionEngine, NEW_PROGRAMME_CANDIDATES };