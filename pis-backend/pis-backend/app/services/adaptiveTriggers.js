// ── DISCOVERY QUESTIONS: ADAPTIVE TRIGGERS ───────────
// STUB — not defined in either PIS spec doc (PIS_Discovery_Questions_Build_
// Spec_v2 or PIS_Spec_Programme_Architecture_Page). questionsContextService.js
// comments mention "track-boundary" and "long-modular-calendar" situations
// as the intended purpose, but no actual rule set was ever specified or
// implemented — this file was empty (0 bytes) before this stub, which is
// what caused "runAdaptiveTriggers is not a function" / crashes elsewhere.
//
// This stub returns no additions and no audit rows, so the rest of the
// Discovery Questions pipeline (suppression engine, essentiality bands,
// previous cohort context) runs correctly without this feature. Replace
// the body of runAdaptiveTriggers with real logic once the actual trigger
// conditions are defined — for example, appending an extra question when
// logistics.duration_phases spans more than N months, or when a programme's
// phases cross a track boundary.

const runAdaptiveTriggers = (opportunityBlock) => {
  return {
    additions: [],
    audit: []
  };
};

module.exports = { runAdaptiveTriggers };