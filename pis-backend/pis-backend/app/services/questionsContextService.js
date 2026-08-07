// ── DISCOVERY QUESTIONS: CONTEXT ASSEMBLY ────────────
// Pure data assembly — no LLM calls here. Reads what's already stored on
// the Opportunity (and, for Repeat/Same-Cohort modes, a linked previous
// opportunity) and returns the "full inheritance payload" the suppression
// engine and question-generation prompt both consume.

const Opportunity = require('../models/Opportunity');

// ── Build the previous_cohort_context block, only when relevant ──
const buildPreviousCohortContext = async (previousOpportunityId) => {
  if (!previousOpportunityId) return null;

  const prev = await Opportunity.findById(previousOpportunityId);
  if (!prev) return null;

  return {
    previous_opportunity: {
      name: prev.client_name,
      delivered_on: prev.due_date || null,
      duration: prev.architecture?.total_days || null,
      format: prev.logistics?.format?.primary || null
    },
    previous_architecture_summary: prev.architecture?.programme_name || null,
    previous_nps: prev.score?.total ?? null,
    // Placeholders until a real feedback/NPS capture stage exists —
    // flagged here rather than silently omitted, so Frontend and the AI
    // teammate know this is not wired to real data yet.
    previous_top_positives: [],
    previous_top_critiques: [],
    previous_decision_makers: (prev.interpreted?.stakeholder_map?.value || [])
      .map(s => ({ name: s.name, role: s.role })),
    previous_answers_by_theme: (prev.questions || []).reduce((acc, q) => {
      if (!q.theme_code) return acc;
      acc[q.theme_code] = acc[q.theme_code] || [];
      acc[q.theme_code].push({ question: q.question_text, answer: q.answer_text });
      return acc;
    }, {})
  };
};

// ── Assemble the full context payload for one opportunity ──
const buildQuestionsContext = async (opportunityId) => {
  const opp = await Opportunity.findById(opportunityId);
  if (!opp) {
    const err = new Error('Opportunity not found');
    err.status = 404;
    throw err;
  }

  if (!opp.interpreted?.goals?.value) {
    const err = new Error('Run brief interpretation first');
    err.status = 400;
    throw err;
  }

  const previous_cohort_context = await buildPreviousCohortContext(opp.previous_opportunity_id);

  const opportunityBlock = {
    id: opp._id,
    programme_kind: opp.programme_mode || 'new',
    previous_opportunity_id: opp.previous_opportunity_id || null,
    brief_interpretation: {
      problem_statement: opp.interpreted.problem_statement,
      goals: opp.interpreted.goals,
      audience: opp.interpreted.audience,
      why_they_need_it: opp.interpreted.why_needed,
      themes: opp.interpreted.themes,
      suggested_competencies: opp.competencies || [],
      stakeholder_map: opp.interpreted.stakeholder_map?.value || []
    },
    logistics: opp.logistics || {},
    attachments: [] // populated once document upload (Phase 4 from the New Opportunity plan) ships
  };

  const { runSuppressionEngine } = require('./suppressionEngine');
  const { getQuestionSet } = require('../data/discoveryQuestionBank');

  let suppression;

  if (opportunityBlock.programme_kind === 'new') {
    // Suppression rules apply — some of the 8 candidates may be dropped
    // or downgraded based on Page 1 confidence/provenance.
    suppression = runSuppressionEngine(opportunityBlock);
  } else {
    // Repeat and Same-Cohort modes have no suppression logic at all
    // (spec Sections 5-6 define fixed baselines) — every question in
    // their bank is returned as-is, always essential, never downgraded.
    const fixedSet = getQuestionSet(opportunityBlock.programme_kind);
    suppression = {
      applies: false,
      questions: fixedSet.map(q => ({
        candidate_id: q.id,
        theme_code: q.theme_code,
        question_text: q.question_text,
        rationale: q.rationale,
        downstream_use: q.downstream_use,
        essentiality: 'essential',
        variant: 'open',
        prefill: false,
        suppression_reason: null,
      })),
      suppressed_count: 0,
      audit: [],
    };
  }

  // Adaptive triggers run regardless of programme_mode — a track-boundary
  // or long-modular-calendar situation is just as real for a Repeat
  // programme as a New one, so these questions can append onto any of the
  // three baseline sets already assembled above.
  const { runAdaptiveTriggers } = require('./adaptiveTriggers');
  const adaptive = runAdaptiveTriggers(opportunityBlock);

  suppression.questions = [...suppression.questions, ...adaptive.additions];
  suppression.audit = [...suppression.audit, ...adaptive.audit];

  // Adaptive triggers run regardless of programme_mode — a track-boundary
  // or long-modular-calendar situation is just as real for a Repeat
  // programme as a New one, so these questions can append onto any of the
  // three baseline sets already assembled above.
  const { runAdaptiveTriggers } = require('./adaptiveTriggers');
  const adaptive = runAdaptiveTriggers(opportunityBlock);

  suppression.questions = [...suppression.questions, ...adaptive.additions];
  suppression.audit = [...suppression.audit, ...adaptive.audit];

  // Adaptive triggers run regardless of programme_mode — a track-boundary
  // or long-modular-calendar situation is just as real for a Repeat
  // programme as a New one, so these questions can append onto any of the
  // three baseline sets already assembled above.
  const { runAdaptiveTriggers } = require('./adaptiveTriggers');
  const adaptive = runAdaptiveTriggers(opportunityBlock);

  suppression.questions = [...suppression.questions, ...adaptive.additions];
  suppression.audit = [...suppression.audit, ...adaptive.audit];

  return {
    opportunity: opportunityBlock,
    previous_cohort_context,
    suppression
  };
};

module.exports = { buildQuestionsContext };