const {
  getBaselineQuestions
} = require('../data/discoveryQuestionBank');

const SUPPRESSION_RULES = [
  {
    id: 'suppress_duration_if_fixed',
    description:
      'Suppress duration questions when programme duration is already specified',
    applies: (context) =>
      Boolean(context?.durationDays)
  },

  {
    id: 'suppress_format_if_fixed',
    description:
      'Suppress delivery format questions when format is already known',
    applies: (context) =>
      Boolean(context?.format)
  },

  {
    id: 'suppress_audience_if_fixed',
    description:
      'Suppress audience questions when audience is already known',
    applies: (context) =>
      Boolean(context?.audience)
  },

  {
    id: 'suppress_location_if_fixed',
    description:
      'Suppress location questions when location is already known',
    applies: (context) =>
      Boolean(context?.location)
  }
];

const normalizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.join(' ').trim().toLowerCase();
  }

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .trim()
    .toLowerCase();
};

const questionText = (question) => {
  return normalizeValue(
    question?.question ||
    question?.text ||
    question?.label ||
    ''
  );
};

const questionId = (question) => {
  return (
    question?.id ||
    question?.question_id ||
    question?.key ||
    ''
  );
};


const shouldSuppressQuestion = (
  question,
  context = {}
) => {
  const text = questionText(question);

  if (!text) {
    return false;
  }

  if (
    context.durationDays &&
    (
      text.includes('duration') ||
      text.includes('how many days') ||
      text.includes('number of days') ||
      text.includes('programme length') ||
      text.includes('program length')
    )
  ) {
    return true;
  }

  if (
    context.format &&
    (
      text.includes('format') ||
      text.includes('delivery mode') ||
      text.includes('delivery format') ||
      text.includes('online') ||
      text.includes('virtual') ||
      text.includes('in-person') ||
      text.includes('in person')
    )
  ) {
    return true;
  }

  if (
    context.audience &&
    (
      text.includes('audience') ||
      text.includes('participants') ||
      text.includes('learners') ||
      text.includes('who is this for')
    )
  ) {
    return true;
  }

  if (
    context.location &&
    (
      text.includes('location') ||
      text.includes('where will') ||
      text.includes('venue')
    )
  ) {
    return true;
  }

  return false;
};


const applySuppressionRule = (
  questions,
  context = {}
) => {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.filter(
    (question) =>
      !shouldSuppressQuestion(
        question,
        context
      )
  );
};


const applyAdaptiveTriggers = (
  questions,
  context = {}
) => {
  if (!Array.isArray(questions)) {
    return [];
  }

  const result = [...questions];

  const textValues = [
    context?.goals,
    context?.themes,
    context?.problemStatement,
    context?.audience,
    context?.constraints
  ]
    .flatMap((value) =>
      Array.isArray(value)
        ? value
        : [value]
    )
    .filter(Boolean)
    .map(normalizeValue)
    .join(' ');


  if (
    textValues.includes('technical') ||
    textValues.includes('technology') ||
    textValues.includes('software') ||
    textValues.includes('digital') ||
    textValues.includes('engineering')
  ) {
    const technicalQuestions = [
      {
        id: 'adaptive_technical_environment',
        question:
          'What technical environment, tools, or platforms will participants use?',
        type: 'text',
        source: 'adaptive'
      },

      {
        id: 'adaptive_technical_practice',
        question:
          'How much hands-on technical practice should the programme include?',
        type: 'single_select',
        options: [
          'Low',
          'Moderate',
          'High'
        ],
        source: 'adaptive'
      }
    ];

    technicalQuestions.forEach(
      (question) => {
        const exists = result.some(
          (existing) =>
            questionId(existing) ===
            question.id
        );

        if (!exists) {
          result.push(question);
        }
      }
    );
  }


  if (
    textValues.includes('leadership') ||
    textValues.includes('leader') ||
    textValues.includes('management') ||
    textValues.includes('manager')
  ) {
    const leadershipQuestions = [
      {
        id: 'adaptive_leadership_scenarios',
        question:
          'Which leadership situations or real-world scenarios should participants practise?',
        type: 'text',
        source: 'adaptive'
      },

      {
        id: 'adaptive_coaching',
        question:
          'How much coaching or peer feedback should be included?',
        type: 'single_select',
        options: [
          'Low',
          'Moderate',
          'High'
        ],
        source: 'adaptive'
      }
    ];

    leadershipQuestions.forEach(
      (question) => {
        const exists = result.some(
          (existing) =>
            questionId(existing) ===
            question.id
        );

        if (!exists) {
          result.push(question);
        }
      }
    );
  }


  if (
    textValues.includes('hands-on') ||
    textValues.includes('practical') ||
    textValues.includes('project') ||
    textValues.includes('application')
  ) {
    const practicalQuestion = {
      id: 'adaptive_capstone',
      question:
        'Should participants complete a capstone or applied project?',
      type: 'single_select',
      options: [
        'Yes',
        'No'
      ],
      source: 'adaptive'
    };

    const exists = result.some(
      (existing) =>
        questionId(existing) ===
        practicalQuestion.id
    );

    if (!exists) {
      result.push(practicalQuestion);
    }
  }

  return result;
};


const getActiveQuestionSet = (
  opportunityBlock = {},
  context = {}
) => {
  let baselineQuestions = [];

  try {
    baselineQuestions =
      getBaselineQuestions();
  } catch (error) {
    console.error(
      '❌ Failed to load baseline discovery questions:',
      error.message
    );

    baselineQuestions = [];
  }

  if (
    !Array.isArray(baselineQuestions) &&
    Array.isArray(
      baselineQuestions?.questions
    )
  ) {
    baselineQuestions =
      baselineQuestions.questions;
  }

  const mergedContext = {
    ...context,

    durationDays:
      context.durationDays ||
      opportunityBlock?.durationDays ||
      opportunityBlock?.duration_days,

    format:
      context.format ||
      opportunityBlock?.format,

    audience:
      context.audience ||
      opportunityBlock?.audience,

    location:
      context.location ||
      opportunityBlock?.location,

    goals:
      context.goals ||
      opportunityBlock?.goals ||
      opportunityBlock?.interpreted?.goals?.value,

    themes:
      context.themes ||
      opportunityBlock?.themes ||
      opportunityBlock?.interpreted?.themes?.value,

    problemStatement:
      context.problemStatement ||
      opportunityBlock?.problemStatement ||
      opportunityBlock?.interpreted?.problem_statement?.value,

    constraints:
      context.constraints ||
      opportunityBlock?.constraints ||
      opportunityBlock?.interpreted?.constraints?.value
  };

  let activeQuestions =
    applySuppressionRule(
      baselineQuestions,
      mergedContext
    );

  activeQuestions =
    applyAdaptiveTriggers(
      activeQuestions,
      mergedContext
    );

  return activeQuestions;
};


module.exports = {
  SUPPRESSION_RULES,
  getActiveQuestionSet,
  applySuppressionRule,
  applyAdaptiveTriggers,
  shouldSuppressQuestion
};