const { getBaselineQuestions } = require('../data/discoveryQuestionSets');

const CONFIDENCE_THRESHOLD = 0.8;
const TRUSTED_PROVENANCE = 'client_stated';

function resolveField(context, path) {
  return path.split('.').reduce((node, key) => (node ? node[key] : undefined), context);
}

function resolveFoundInSource(field) {
  if (!field || !field.extractedTextRef) return undefined;
  return { extractedTextRef: field.extractedTextRef, attachmentId: field.attachmentId };
}

function applySuppressionRule(question, context) {
  const field = resolveField(context, question.suppressionField);
  const foundInSource = resolveFoundInSource(field);

  const hasValue = field && field.value !== null && field.value !== undefined;
  if (!hasValue) {
    return { ...question, status: 'pending', foundInSource };
  }

  const isTrustworthy = field.confidence >= CONFIDENCE_THRESHOLD && field.provenance === TRUSTED_PROVENANCE;
  if (isTrustworthy) {
    return {
      ...question,
      status: 'skipped_by_rule',
      skipReason: `confidence ${field.confidence} + provenance "${field.provenance}" cleared the trust bar`,
      inheritedValue: field.value,
      foundInSource,
    };
  }
  return {
    ...question,
    status: 'system_confirmed',
    skipReason: `downgraded to confirmation — confidence ${field.confidence ?? 'unknown'}, provenance "${field.provenance ?? 'unknown'}"`,
    inheritedValue: field.value,
    foundInSource,
  };
}

const ADAPTIVE_TRIGGERS = [
  {
    id: 'track-boundary',
    shouldFire: (context) => resolveField(context, 'briefInterpretation.programmeKind')?.value === 'multi_track',
    question: {
      questionId: 'ADAPT-TRACK-01',
      themeCode: 'BCS',
      prompt: 'Since this spans multiple tracks, should content sequencing be shared or run independently per track?',
      rationale: 'Track-boundary trigger — changes Architecture\'s module sequencing directly.',
    },
  },
  {
    id: 'calendar-availability',
    shouldFire: (context) => {
      const deliveryWindow = resolveField(context, 'logistics.deliveryWindow');
      return !deliveryWindow || deliveryWindow.value === null || deliveryWindow.value === undefined;
    },
    question: {
      questionId: 'ADAPT-CAL-01',
      themeCode: 'BAS',
      prompt: 'Roughly which weeks are you targeting, even if not fixed yet?',
      rationale: 'Calendar-availability trigger — Architecture can\'t check faculty availability without at least a rough window.',
    },
  },
];

function applyAdaptiveTriggers(context) {
  return ADAPTIVE_TRIGGERS.filter((trigger) => trigger.shouldFire(context)).map((trigger) => ({
    ...trigger.question,
    status: 'pending',
  }));
}

function getActiveQuestionSet({ mode, context }) {
  const baseline = getBaselineQuestions(mode);
  const resolved = baseline.map((question) => applySuppressionRule(question, context));
  const adaptive = applyAdaptiveTriggers(context);

  return [...resolved, ...adaptive];
}

module.exports = {
  getActiveQuestionSet,
  applySuppressionRule,
  applyAdaptiveTriggers,
  CONFIDENCE_THRESHOLD,
  TRUSTED_PROVENANCE,
};
