// ── AGENT 3: COMPETENCY MAPPER ────────────────────
// Model: Haiku (fast + cheap)
// Input: interpreted opportunity data
// Output: top 5 competencies mapped from framework
// rule: vector similarity FIRST, LLM for explanation only

const llmClient = require('../llm/client');
const PROMPTS = require('../prompts');
const { getCompetenciesForTenant } = require('./competencyFrameworkService');

const mapCompetencies = async (interpreted, tenantId, opportunityId) => {

  // Step 1: Get this tenant's active competency framework — the system
  // default (auto-seeded from the real default file on first use) or
  // whatever framework this tenant has uploaded themselves. This is
  // strictly scoped to tenantId, never a cross-tenant query.
  const allCompetencies = await getCompetenciesForTenant(tenantId);

  if (!allCompetencies || allCompetencies.length === 0) {
    throw new Error('No competencies found for this account.');
  }

  console.log(`📚 Loaded ${allCompetencies.length} competencies for mapping (tenant ${tenantId})`);

  // Step 2: Build prompt with competency list
  const prompt = {
    ...PROMPTS.competency_mapping,
    userMessage: PROMPTS.competency_mapping.user(interpreted, allCompetencies)
  };

  // Step 3: Call Claude Haiku
  const result = await llmClient.extract_json({
    prompt,
    tenantId,
    opportunityId,
    agent: 'competency_mapper'
  });

  // Step 4: Validate output.
  // Be tolerant of the two harmless shape variants a small model sometimes
  // returns despite the prompt's exact-JSON instruction: a bare array
  // instead of { mapped_competencies: [...] }, or the array under a
  // differently-cased/pluralised key. Anything else is a genuine failure.
  let mappedCompetencies = result.mapped_competencies;
  if (!Array.isArray(mappedCompetencies)) {
    if (Array.isArray(result)) {
      mappedCompetencies = result;
    } else {
      const arrayValue = Object.values(result || {}).find(v => Array.isArray(v));
      mappedCompetencies = arrayValue;
    }
  }

  if (!Array.isArray(mappedCompetencies)) {
    console.error('❌ Competency mapper returned an unexpected shape:', JSON.stringify(result));
    throw new Error('Competency mapper returned invalid format');
  }

  // Step 5: Enrich with full competency data from this tenant's framework
  const enriched = mappedCompetencies.map(mapped => {
    const full = allCompetencies.find(c => c.id === mapped.competency_id);
    return {
      competency_id:   mapped.competency_id,
      competency_name: mapped.competency_name || full?.name || 'Unknown',
      cluster:         full?.cluster || 'Unknown',
      definition:      full?.definition || '',
      fit_score:       mapped.fit_score,
      rationale:       mapped.rationale
    };
  });

  // Sort by fit score
  enriched.sort((a, b) => b.fit_score - a.fit_score);

  console.log(`✅ Mapped ${enriched.length} competencies`);
  return enriched;
};

module.exports = { mapCompetencies };
