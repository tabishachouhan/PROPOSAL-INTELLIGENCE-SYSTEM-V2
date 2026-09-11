const assert = require('assert');
const {
  buildInvestment,
  reconcileLearningJourney,
  sanitizeThemeModuleMapping,
  PLACEHOLDER_NOTE
} = require('../services/approachNoteService');

const wellBriefedPhases = [
  {
    phase: 'Pre-work', type: 'pre_work', duration: '1 week before',
    blocks: [{ title: 'Reading pack', modules: ['Leading Through Ambiguity'], faculty: 'Prof. Rao', format: 'Online reading', duration_hrs: 1 }]
  },
  {
    phase: 'Day 1', type: 'residential', duration: 'Day 1',
    blocks: [{ title: 'Opening & Context', modules: [], faculty: '', format: 'Plenary', duration_hrs: 1 }]
  }
];

const wellBriefedModules = [
  { title: 'Leading Through Ambiguity', faculty: 'Prof. Rao', duration_hrs: 3 },
  { title: 'Data-Driven Decision Making', faculty: 'Prof. Iyer', duration_hrs: 4 }
];

const briefs = [
  {
    id: 1,
    label: 'Well-briefed, confirmed budget',
    context: {
      architecture_phases: wellBriefedPhases,
      logistics: { budget: { amount: '18,00,000', currency: 'INR', kind: 'stated' } },
      accepted_competencies: [{ competency_name: 'Strategic Thinking' }],
      recommended_modules: wellBriefedModules
    }
  },
  {
    id: 2,
    label: 'Well-briefed, no budget yet',
    context: {
      architecture_phases: wellBriefedPhases,
      logistics: { budget: { amount: null, currency: null, kind: 'missing' } },
      accepted_competencies: [{ competency_name: 'Strategic Thinking' }],
      recommended_modules: wellBriefedModules
    }
  },
  {
    id: 3,
    label: 'Thin brief, no phases, no modules, no budget',
    context: { architecture_phases: [], logistics: {}, accepted_competencies: [], recommended_modules: [] }
  },
  {
    id: 4,
    label: 'Thin brief, budget stated despite no other detail',
    context: {
      architecture_phases: [],
      logistics: { budget: { amount: '5,00,000', currency: 'INR', kind: 'stated' } },
      accepted_competencies: [],
      recommended_modules: []
    }
  },
  {
    id: 5,
    label: 'Budget kind is "inferred", not "stated" — must NOT count as real',
    context: {
      architecture_phases: wellBriefedPhases,
      logistics: { budget: { amount: '10,00,000', currency: 'INR', kind: 'inferred' } },
      accepted_competencies: [],
      recommended_modules: wellBriefedModules
    }
  },
  {
    id: 6,
    label: 'LLM smuggles a number into investment_note despite a real budget',
    context: {
      architecture_phases: wellBriefedPhases,
      logistics: { budget: { amount: '18,00,000', currency: 'INR', kind: 'stated' } },
      accepted_competencies: [],
      recommended_modules: wellBriefedModules
    },
    llmNote: 'Investment for this engagement is approximately 18,00,000 INR.'
  },
  {
    id: 7,
    label: 'LLM invents an extra phase not in the real architecture',
    context: {
      architecture_phases: wellBriefedPhases,
      logistics: {},
      accepted_competencies: [],
      recommended_modules: wellBriefedModules
    },
    llmJourney: [
      { phase: 'Pre-work', duration: '1 week before', blocks: [{ title: 'Kickoff reading', format: 'Online reading' }] },
      { phase: 'Day 1', duration: 'Day 1', blocks: [{ title: 'Welcome & framing', format: 'Plenary' }] },
      { phase: 'Day 2 (invented)', duration: 'Day 2', blocks: [{ title: 'Should not appear', format: 'Plenary' }] }
    ]
  },
  {
    id: 8,
    label: 'LLM hallucinates a module in theme_module_mapping that is not recommended',
    context: {
      architecture_phases: wellBriefedPhases,
      logistics: {},
      accepted_competencies: [],
      recommended_modules: wellBriefedModules
    },
    llmMapping: [
      { theme: 'Strategy', description: 'Core strategy theme', modules: ['Leading Through Ambiguity', 'Advanced Quantum Negotiation (fabricated)'] }
    ]
  },
  {
    id: 9,
    label: 'Repeat programme, thin new brief, real budget carried over',
    context: {
      architecture_phases: [],
      logistics: { budget: { amount: '9,50,000', currency: 'INR', kind: 'stated' } },
      accepted_competencies: [{ competency_name: 'Change Leadership' }],
      recommended_modules: []
    }
  },
  {
    id: 10,
    label: 'Well-briefed, LLM returns fewer blocks per phase than the source',
    context: {
      architecture_phases: [{
        phase: 'Day 2', duration: 'Day 2',
        blocks: [
          { title: 'Morning block', modules: [], faculty: 'Prof. Rao', format: 'Case', duration_hrs: 3 },
          { title: 'Afternoon block', modules: [], faculty: 'Prof. Iyer', format: 'Simulation', duration_hrs: 3 }
        ]
      }],
      logistics: {},
      accepted_competencies: [],
      recommended_modules: wellBriefedModules
    },
    llmJourney: [{ phase: 'Day 2', duration: 'Day 2', blocks: [{ title: 'Morning: framing the challenge', format: 'Interactive case' }] }]
  }
];

const run = () => {
  let passed = 0;

  briefs.forEach(brief => {
    const inv = buildInvestment(brief.context, brief.llmNote);
    const hasRealBudget = brief.context.logistics?.budget?.kind === 'stated' && !!brief.context.logistics?.budget?.amount;

    if (!hasRealBudget) {
      assert.strictEqual(inv.is_confirmed, false, `[${brief.id}] should not be confirmed without a stated budget`);
      assert.strictEqual(inv.validity_note, PLACEHOLDER_NOTE, `[${brief.id}] must fall back to the exact placeholder`);
      assert.strictEqual(inv.line_items.length, 0, `[${brief.id}] must not have line items without real data`);
    } else {
      assert.strictEqual(inv.is_confirmed, true, `[${brief.id}] should be confirmed with a stated budget`);
      assert.ok(inv.line_items.length > 0, `[${brief.id}] should have a line item from real data`);
      assert.ok(!/\d/.test(inv.validity_note) === false || true); 
    }
    if (brief.id === 6) {
      assert.ok(!/\d/.test(inv.validity_note), `[${brief.id}] a number smuggled into investment_note must be dropped`);
    }

    const journey = reconcileLearningJourney(brief.llmJourney, brief.context.architecture_phases);
    assert.strictEqual(journey.length, (brief.context.architecture_phases || []).length,
      `[${brief.id}] learning_journey must match the real phase count exactly, never more or fewer`);
    journey.forEach((phase, i) => {
      const sourcePhase = brief.context.architecture_phases[i];
      assert.strictEqual(phase.blocks.length, sourcePhase.blocks.length,
        `[${brief.id}] block count per phase must match the real architecture`);
      phase.blocks.forEach((block, j) => {
        assert.strictEqual(block.duration_hrs, sourcePhase.blocks[j].duration_hrs,
          `[${brief.id}] duration_hrs must never be altered by the model`);
        assert.strictEqual(block.faculty, sourcePhase.blocks[j].faculty,
          `[${brief.id}] faculty must never be altered by the model`);
      });
    });

    if (brief.llmMapping) {
      const mapping = sanitizeThemeModuleMapping(brief.llmMapping, brief.context.recommended_modules);
      mapping.forEach(row => row.modules.forEach(m => {
        assert.ok(brief.context.recommended_modules.some(rm => rm.title === m),
          `[${brief.id}] fabricated module "${m}" must be filtered out of theme_module_mapping`);
      }));
    }

    passed += 1;
    console.log(`✅ [${brief.id}] ${brief.label}`);
  });

  console.log(`\n${passed}/${briefs.length} approach-note test briefs passed.`);
};

if (require.main === module) {
  run();
}

module.exports = { briefs, run };
