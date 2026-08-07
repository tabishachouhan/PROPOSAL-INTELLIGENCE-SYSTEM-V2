const DiscoveryAnswer = require('../models/discoveryAnswer.model');

// Swap this for the real client once Proposal Scoring exposes one.
// Kept as a require so the rest of this file doesn't care whether it's
// an HTTP call, a local module, or a queue job under the hood.
let scoringService;
try {
  scoringService = require('./proposalScoring.client');
} catch {
  scoringService = null; // not wired up yet — fall back to a local check below
}

const OPEN_STATUSES = ['pending'];
const RESOLVED_STATUSES = ['answered', 'skipped_by_rule', 'system_confirmed'];

/**
 * Quick summary of where an opportunity's discovery answers currently stand.
 * Pure function over the answers array so it's cheap to reuse from the
 * GET /answers/:opportunityId route without hitting the DB twice.
 */
function getWorkflowState(answers) {
  const total = answers.length;
  const resolved = answers.filter((a) => RESOLVED_STATUSES.includes(a.status)).length;
  const pending = answers.filter((a) => OPEN_STATUSES.includes(a.status)).length;

  return {
    totalQuestions: total,
    resolved,
    pending,
    isComplete: total > 0 && pending === 0,
  };
}

/**
 * C.4 — Validation & Scoring Integration.
 * Asks Proposal Scoring whether discovery is "done enough" to move on.
 * If that service isn't wired up yet, we fall back to our own
 * all-questions-resolved check so this endpoint still works standalone.
 */
async function checkCompletenessWithScoring(opportunityId, answers) {
  if (scoringService && typeof scoringService.checkDiscoveryCompleteness === 'function') {
    return scoringService.checkDiscoveryCompleteness(opportunityId, answers);
  }

  const state = getWorkflowState(answers);
  return {
    complete: state.isComplete,
    missing: answers.filter((a) => OPEN_STATUSES.includes(a.status)).map((a) => a.questionId),
    source: 'local-fallback', // flag so we can tell this apart from a real scoring response
  };
}

/**
 * C.2 — Workflow Controller.
 * Moves an opportunity from Discovery into Architecture/Mapping once
 * everything's resolved. Left as a plain status stamp on the answers'
 * parent opportunity rather than a separate state machine table — the
 * PIS opportunity record already tracks stage, so we just advance it.
 */
async function advanceOpportunityStage(opportunityId) {
  const Opportunity = require('../models/opportunity.model'); // lazy require avoids a circular import with Member A's model
  return Opportunity.findByIdAndUpdate(
    opportunityId,
    { currentStage: 'competency_mapping', discoveryCompletedAt: new Date() },
    { new: true }
  );
}

/**
 * C.3 — Downstream Payload Preparation.
 * Three small, deliberately dumb transformers. Each one only knows how to
 * reshape answers for its one consumer — resist the urge to merge these
 * into one mega-payload, since Architecture and Approach Note evolve on
 * separate timelines from each other.
 */

function toCompetencyMappingPayload(answers) {
  const competencyAnswers = answers.filter((a) => a.themeCode === 'BCS' && a.status !== 'pending');
  return {
    suggestedCompetencies: competencyAnswers.map((a) => ({
      questionId: a.questionId,
      value: a.value,
    })),
  };
}

function toArchitecturePayload(answers) {
  const audienceAnswers = answers.filter((a) => a.themeCode === 'AUD' && a.status !== 'pending');
  return {
    facultyArchetypeHints: audienceAnswers
      .filter((a) => a.questionId.toLowerCase().includes('faculty'))
      .map((a) => a.value),
    peerGroupingSensitivities: audienceAnswers
      .filter((a) => a.questionId.toLowerCase().includes('peer'))
      .map((a) => a.value),
  };
}

function toApproachNotePayload(answers) {
  const strategicTrigger = answers.find((a) => a.questionId.toLowerCase().includes('trigger'));
  const targetBehaviour = answers.find((a) => a.questionId.toLowerCase().includes('behaviour'));

  return {
    strategicTrigger: strategicTrigger?.value ?? null,
    targetBehaviour: targetBehaviour?.value ?? null,
  };
}

/**
 * Ties C.2 + C.3 + C.4 together for the /complete endpoint: check
 * completeness, and only if that clears, advance the stage and build the
 * downstream payloads. Otherwise hand back what's still outstanding.
 */
async function runDiscoveryCompletionCheck(opportunityId) {
  const answers = await DiscoveryAnswer.find({ opportunityId });
  const scoring = await checkCompletenessWithScoring(opportunityId, answers);

  if (!scoring.complete) {
    return { ready: false, missing: scoring.missing };
  }

  const opportunity = await advanceOpportunityStage(opportunityId);

  return {
    ready: true,
    opportunityStage: opportunity?.currentStage,
    downstream: {
      competencyMapping: toCompetencyMappingPayload(answers),
      architecture: toArchitecturePayload(answers),
      approachNote: toApproachNotePayload(answers),
    },
  };
}

module.exports = {
  getWorkflowState,
  runDiscoveryCompletionCheck,
  toCompetencyMappingPayload,
  toArchitecturePayload,
  toApproachNotePayload,
};
