const llmClient = require('../llm/client');
const PROMPTS = require('../prompts');

const PLACEHOLDER_NOTE = '[Pricing to be confirmed with commercial team]';

const buildInvestment = (context, llmNote) => {
  const budget = context?.logistics?.budget;
  const hasRealFigure = !!(budget && budget.kind === 'stated' && budget.amount);

  if (!hasRealFigure) {
    return {
      line_items: [],
      is_confirmed: false,
      validity_note: PLACEHOLDER_NOTE
    };
  }

  const looksNumberFree = typeof llmNote === 'string' && llmNote.trim() && !/[\d$€£₹]/.test(llmNote);
  const amountLabel = `${budget.amount}${budget.currency ? ` ${budget.currency}` : ''}`;

  return {
    line_items: [{
      description: 'Programme delivery, indicative investment',
      qty: '1',
      unit_price: amountLabel,
      total: amountLabel
    }],
    is_confirmed: true,
    validity_note: looksNumberFree ? llmNote.trim() : 'Indicative investment based on the confirmed client budget.'
  };
};

const reconcileLearningJourney = (llmJourney, sourcePhases) => {
  const phases = Array.isArray(sourcePhases) ? sourcePhases : [];
  if (!phases.length) {
    return Array.isArray(llmJourney) ? llmJourney : [];
  }

  const llmByIndex = Array.isArray(llmJourney) ? llmJourney : [];

  return phases.map((sourcePhase, i) => {
    const llmPhase = llmByIndex[i] || {};
    const sourceBlocks = Array.isArray(sourcePhase.blocks) ? sourcePhase.blocks : [];
    const llmBlocks = Array.isArray(llmPhase.blocks) ? llmPhase.blocks : [];

    return {
      phase: sourcePhase.phase,
      duration: sourcePhase.duration,
      blocks: sourceBlocks.map((sourceBlock, j) => {
        const llmBlock = llmBlocks[j] || {};
        return {
          title: typeof llmBlock.title === 'string' && llmBlock.title.trim()
            ? llmBlock.title.trim()
            : sourceBlock.title,
          modules: Array.isArray(sourceBlock.modules) ? sourceBlock.modules : [],
          faculty: sourceBlock.faculty || '',
          format: typeof llmBlock.format === 'string' && llmBlock.format.trim()
            ? llmBlock.format.trim()
            : sourceBlock.format,
          duration_hrs: sourceBlock.duration_hrs
        };
      })
    };
  });
};

const sanitizeThemeModuleMapping = (llmMapping, recommendedModules) => {
  const validTitles = new Set((recommendedModules || []).map(m => m.title));
  if (!Array.isArray(llmMapping)) return [];

  return llmMapping.map(row => ({
    theme: row?.theme || '',
    description: row?.description || '',
    modules: Array.isArray(row?.modules) ? row.modules.filter(m => validTitles.has(m)) : []
  })).filter(row => row.theme);
};

const REQUIRED_TEXT_FIELDS = [
  'context_and_challenge',
  'programme_philosophy',
  'faculty_bench',
  'evaluation_approach',
  'analogous_engagements'
];

const writeApproachNote = async (opportunity, context = {}) => {
  console.log('✍️  Agent 6: Writing approach note with Claude Sonnet...');
  console.log('⏳ This takes 15-20 seconds — Sonnet generates high quality text...');

  const prompt = {
    ...PROMPTS.approach_note,
    userMessage: PROMPTS.approach_note.user(opportunity, context)
  };

  const result = await llmClient.extract_json({
    prompt,
    tenantId: opportunity.tenant_id,
    opportunityId: opportunity._id,
    agent: 'approach_note_writer'
  });

  const missing = REQUIRED_TEXT_FIELDS.filter(f => !result[f]);
  if (missing.length > 0) {
    console.warn(`⚠️ Missing approach note fields: ${missing.join(', ')}`);
  }

  const sourcePhases = context.architecture_phases || opportunity.architecture?.phases || [];
  const recommendedModules = context.recommended_modules || opportunity.modules || [];

  const approachNote = {
    context_and_challenge: result.context_and_challenge || '',
    programme_philosophy: result.programme_philosophy || '',
    theme_module_mapping: sanitizeThemeModuleMapping(result.theme_module_mapping, recommendedModules),
    learning_journey: reconcileLearningJourney(result.learning_journey, sourcePhases),
    faculty_bench: result.faculty_bench || '',
    evaluation_approach: result.evaluation_approach || '',
    analogous_engagements: result.analogous_engagements || '',
    investment: buildInvestment(context, result.investment_note)
  };

  console.log(`✅ Approach note written — ${result.word_count || 'unknown'} words`);
  return approachNote;
};

module.exports = {
  writeApproachNote,
  buildInvestment,
  reconcileLearningJourney,
  sanitizeThemeModuleMapping,
  PLACEHOLDER_NOTE
};
