const NEW_PROGRAMME_QUESTIONS = [
  {
    questionId: 'BCS-01',
    themeCode: 'BCS',
    prompt: 'What business outcome is this programme meant to drive?',
    suppressionField: 'briefInterpretation.businessDriver',
    rationale: 'Shapes the case-study and module selection in Architecture.',
  },
  {
    questionId: 'BCS-02',
    themeCode: 'BCS',
    prompt: 'What does success look like six months after the programme ends?',
    suppressionField: 'briefInterpretation.successDefinition',
    rationale: 'Feeds the Approach Note\'s target behaviour section directly.',
  },
  {
    questionId: 'AUD-01',
    themeCode: 'AUD',
    prompt: 'What seniority band and function does the audience sit in?',
    suppressionField: 'briefInterpretation.audienceProfile',
    rationale: 'Drives faculty archetype suggestions in Architecture.',
  },
  {
    questionId: 'AUD-02',
    themeCode: 'AUD',
    prompt: 'Are there sensitivities around mixing participants from different business units?',
    suppressionField: 'briefInterpretation.peerGroupingSensitivity',
    rationale: 'Directly changes peer grouping in Architecture — skip only if explicitly stated.',
  },
  {
    questionId: 'BAS-01',
    themeCode: 'BAS',
    prompt: 'What is the confirmed or target budget range?',
    suppressionField: 'logistics.budget',
    rationale: 'Changes format/duration options presented downstream.',
  },
  {
    questionId: 'BAS-02',
    themeCode: 'BAS',
    prompt: 'Are there fixed delivery dates or a delivery window?',
    suppressionField: 'logistics.deliveryWindow',
    rationale: 'Changes scheduling and faculty availability checks.',
  },
  {
    questionId: 'BAS-03',
    themeCode: 'BAS',
    prompt: 'Is delivery in-person, virtual, or hybrid?',
    suppressionField: 'logistics.deliveryMode',
    rationale: 'Changes the entire Architecture module structure.',
  },
  {
    questionId: 'BCS-03',
    themeCode: 'BCS',
    prompt: 'What internal strategic initiative, if any, is this programme tied to?',
    suppressionField: 'briefInterpretation.strategicTrigger',
    rationale: 'Populates the Approach Note\'s strategic trigger field.',
  },
];

const REPEAT_PROGRAMME_QUESTIONS = [
  {
    questionId: 'BCS-01',
    themeCode: 'BCS',
    prompt: 'Has the business outcome for this run changed from last time?',
    suppressionField: 'previousCohortContext.businessDriver',
    rationale: 'Only worth asking because it can override inherited context.',
  },
  {
    questionId: 'AUD-01',
    themeCode: 'AUD',
    prompt: 'Is the audience profile the same as the previous cohort?',
    suppressionField: 'previousCohortContext.audienceProfile',
    rationale: 'A "no" here reopens Architecture decisions that would otherwise carry over.',
  },
  {
    questionId: 'BAS-01',
    themeCode: 'BAS',
    prompt: 'Has the budget changed from the previous run?',
    suppressionField: 'previousCohortContext.budget',
    rationale: 'Changes format/duration options if it moved.',
  },
  {
    questionId: 'BAS-02',
    themeCode: 'BAS',
    prompt: 'Are the delivery dates fixed yet for this run?',
    suppressionField: 'logistics.deliveryWindow',
    rationale: 'Logistics don\'t carry over from a previous cohort the way profile data does.',
  },
  {
    questionId: 'BCS-02',
    themeCode: 'BCS',
    prompt: 'Any feedback from the last cohort that should change this run\'s focus?',
    suppressionField: 'previousCohortContext.priorFeedback',
    rationale: 'Directly changes module emphasis in Architecture.',
  },
];

const SAME_COHORT_QUESTIONS = [
  {
    questionId: 'BCS-01',
    themeCode: 'BCS',
    prompt: 'Is the business outcome for this module unchanged from the cohort\'s prior stage?',
    suppressionField: 'previousCohortContext.businessDriver',
    rationale: 'Same-cohort inherits nearly everything — this catches drift.',
  },
  {
    questionId: 'BAS-01',
    themeCode: 'BAS',
    prompt: 'Are delivery dates confirmed for this stage?',
    suppressionField: 'logistics.deliveryWindow',
    rationale: 'Scheduling is stage-specific even within the same cohort.',
  },
  {
    questionId: 'BAS-02',
    themeCode: 'BAS',
    prompt: 'Is the delivery mode the same as the previous stage?',
    suppressionField: 'logistics.deliveryMode',
    rationale: 'Occasionally a cohort switches from virtual to in-person mid-programme.',
  },
  {
    questionId: 'BCS-02',
    themeCode: 'BCS',
    prompt: 'Is there a new strategic trigger for this stage specifically?',
    suppressionField: 'briefInterpretation.strategicTrigger',
    rationale: 'Approach Note is generated per stage, not once for the whole cohort.',
  },
  {
    questionId: 'AUD-01',
    themeCode: 'AUD',
    prompt: 'Any change in who\'s attending this stage vs. the last one?',
    suppressionField: 'previousCohortContext.audienceProfile',
    rationale: 'Attendance drift changes faculty archetype fit.',
  },
  {
    questionId: 'BAS-03',
    themeCode: 'BAS',
    prompt: 'Has the budget for this stage been separately confirmed?',
    suppressionField: 'logistics.budget',
    rationale: 'Stage-level budgets can diverge from the cohort-level figure.',
  },
];

const QUESTION_SETS_BY_MODE = {
  new: NEW_PROGRAMME_QUESTIONS,
  repeat: REPEAT_PROGRAMME_QUESTIONS,
  same_cohort: SAME_COHORT_QUESTIONS,
};

function getBaselineQuestions(mode) {
  const set = QUESTION_SETS_BY_MODE[mode];
  if (!set) {
    throw new Error(`Unknown discovery mode "${mode}" — expected one of: ${Object.keys(QUESTION_SETS_BY_MODE).join(', ')}`);
  }
  return set;
}

module.exports = { getBaselineQuestions, QUESTION_SETS_BY_MODE };
