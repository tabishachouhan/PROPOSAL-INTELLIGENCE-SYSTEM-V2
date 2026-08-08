import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  generateQuestions,
  resolveAnswer,
  updateQuestionAnswer,
  getQuestionsContext
} from "../services/api";
import ProcessingState from "../components/ProcessingState";

// One framework tag per THEME (e.g. all "Business Context & Strategy" questions
// share one framework). Labeling only — no AI involved.
const FRAMEWORK_OPTIONS = [
  "Porter's Five Forces",
  "SWOT Analysis",
  "Balanced Scorecard",
  "McKinsey 7S",
  "Kirkpatrick's 4 Levels",
  "ADDIE Model",
  "70:20:10 Learning Model",
  "Business Model Canvas",
  "GROW Coaching Model",
  "Other / Custom"
];

const THEME_NAMES = {
  BCS: "Business Context & Strategy",
  AUD: "Audience & Cohort Design",
  BAS: "Capability Baseline",
  BEH: "Target Behaviours",
  PED: "Pedagogical Preferences",
  CON: "Constraints",
  DEC: "Decision Dynamics",
  FOL: "Post-programme Follow-up"
};

const THEME_COLORS = {
  BCS: "#dbeafe", AUD: "#ede9fe", BAS: "#dcfce7",
  BEH: "#fef3c7", PED: "#fce7f3", CON: "#fee2e2",
  DEC: "#e0f2fe", FOL: "#f0fdf4"
};

// ── Essentiality bands — deterministic, comes from the suppression engine.
// No LLM ranks these; the backend just tags each surviving candidate. ──
const ESSENTIALITY_ORDER = ["essential", "confirmation", "optional"];
const ESSENTIALITY_META = {
  essential:    { label: "Essential",    accent: "#dc2626", bg: "#fef2f2", border: "#fecaca", blurb: "Must be answered before this proposal can move forward." },
  confirmation: { label: "Confirmation", accent: "#d97706", bg: "#fffbeb", border: "#fde68a", blurb: "Likely answer is already implied — confirm rather than ask from scratch." },
  optional:     { label: "Optional",     accent: "#64748b", bg: "#f8fafc", border: "#e2e8f0", blurb: "Nice to have. Skip freely if time with the client is short." }
};

// ── Provenance chip — every auto-populated answer must carry one, per spec 9.5 ──
const SOURCE_LABEL = {
  from_brief:        { text: "Found in brief",             color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  flagged_to_client: { text: "Flagged to client",          color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  draft_assumption:  { text: "Draft assumption",           color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  pull_from_previous:{ text: "Pulled from previous cohort", color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" }
};

const normalize = (s = "") => s.trim().toLowerCase().replace(/\s+/g, " ");

export default function QuestionsStage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [liveMode, setLiveMode] = useState(false);

  // Track per-question async state: { [index]: { resolving: mode|null, notice: string|null } }
  const [rowState, setRowState] = useState({});

  // ── Per-theme framework tags: { BCS: "SWOT Analysis", DEC: "McKinsey 7S", ... } ──
  const [themeFrameworks, setThemeFrameworks] = useState({});
  const [openThemeDropdown, setOpenThemeDropdown] = useState(null); // which theme's dropdown is open

  // ── Section 12.1 context payload: essentiality, suppression, previous_cohort_context ──
  const [context, setContext] = useState(null);
  const [contextError, setContextError] = useState("");
  const [suppressionPanelOpen, setSuppressionPanelOpen] = useState(false);
  const [cohortPanelCollapsed, setCohortPanelCollapsed] = useState(false);

  // ── Pull-from-previous matches, kept client-side so provenance chips can
  // open a drawer showing exactly what was pulled and from where. ──
  const [previousMatches, setPreviousMatches] = useState({}); // { [index]: { cohortName, question, answer } }
  const [drawerIndex, setDrawerIndex] = useState(null);

  const opportunityId = localStorage.getItem("pis_opportunity_id");
  const frameworkStorageKey = `pis_theme_frameworks_${opportunityId}`;
  const questionsStorageKey = `pis_questions_${opportunityId}`;
  const previousMatchesStorageKey = `pis_previous_matches_${opportunityId}`;

  useEffect(() => {
    if (!opportunityId) { navigate("/new"); return; }

    // ── Show cached questions INSTANTLY if we have them, so the page never
    // flashes "No questions yet" while waiting on the network. ──
    let hadCache = false;
    try {
      const cached = localStorage.getItem(questionsStorageKey);
      if (cached) {
        const parsedQuestions = JSON.parse(cached);
        if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
          setQuestions(parsedQuestions);
          hadCache = true;
        }
      }
    } catch {
      // ignore malformed cache, fall through to network load
    }

    // Always still confirm against the server in the background — this picks
    // up newer answers/resolves from other tabs/devices and self-heals if the
    // cache was ever stale, but it no longer causes a blank flash.
    loadQuestions(hadCache);
    loadContext();

    // Restore any framework tags previously set for this opportunity
    try {
      const saved = localStorage.getItem(frameworkStorageKey);
      if (saved) setThemeFrameworks(JSON.parse(saved));
    } catch {
      // ignore malformed storage, just start fresh
    }

    // Restore any "pulled from previous cohort" matches from an earlier session
    try {
      const savedMatches = localStorage.getItem(previousMatchesStorageKey);
      if (savedMatches) setPreviousMatches(JSON.parse(savedMatches));
    } catch {
      // ignore malformed storage, just start fresh
    }
  }, []);

  const loadQuestions = async (hadCache = false) => {
    // Only show the big loading spinner if we have nothing on screen yet —
    // if cached questions are already showing, refresh quietly in the background.
    if (!hadCache) setLoading(true);
    setError("");
    try {
      const data = await generateQuestions(opportunityId);
      const flat = data.questions_by_theme
        ? Object.values(data.questions_by_theme).flat()
        : data.data || [];

      if (flat.length === 0) {
        if (!hadCache) {
          // The call succeeded but returned no questions, and we had no cache
          // to fall back on — this usually means brief interpretation hasn't
          // run yet for this opportunity, or the ID in storage is stale.
          setError("This opportunity has no questions yet and none could be generated. Try going back to New Opportunity and re-analysing the brief.");
        }
        // If we DID have cache, keep showing it rather than wiping the screen —
        // a transient/empty server response should never erase visible work.
      } else {
        setQuestions(flat);
        try {
          localStorage.setItem(questionsStorageKey, JSON.stringify(flat));
        } catch {
          // storage full or unavailable — page still works for this session
        }
      }
    } catch (err) {
      // If we had cached questions already on screen, a failed background
      // refresh shouldn't blank the page — just surface a quiet warning.
      if (!hadCache) {
        setError(err?.response?.data?.error || "Failed to load questions");
      } else {
        console.error("Background refresh failed, keeping cached questions:", err);
      }
    }
    setLoading(false);
  };

  // ── Loads essentiality bands, suppression audit, previous_cohort_context.
  // This is an enrichment layer — if it fails, the page still works with a
  // flat "everything is essential" view, it just loses the extra context. ──
  const loadContext = async () => {
    setContextError("");
    try {
      const data = await getQuestionsContext(opportunityId);
      setContext(data);
    } catch (err) {
      console.error("Context load failed:", err);
      setContextError(err?.response?.data?.error || "Could not load suppression/cohort context — showing questions without it.");
    }
  };

  const setRow = (index, patch) => {
    setRowState((prev) => ({ ...prev, [index]: { ...prev[index], ...patch } }));
  };

  // Extracts the clearest possible message from any axios error
  const describeError = (err) => {
    if (err?.response?.data?.error) return err.response.data.error;
    if (err?.response?.status) return `Server returned ${err.response.status}`;
    if (err?.message === "Network Error") return "Could not reach the backend — check it's running and reachable.";
    return err?.message || "Something went wrong";
  };

  const persistPreviousMatches = (updated) => {
    setPreviousMatches(updated);
    try {
      localStorage.setItem(previousMatchesStorageKey, JSON.stringify(updated));
    } catch {
      // storage full or unavailable — chip still works for this session
    }
  };

  // ── Option 1 / 2 / 3 handler ───────────────────
  const handleResolve = async (question, index, mode) => {
    setRow(index, { resolving: mode, notice: null });
    try {
      const res = await resolveAnswer(opportunityId, index, mode);

      if (mode === "from_brief" && res.found === false) {
        setRow(index, { resolving: null, notice: res.message || "Brief does not clearly answer this question." });
        return;
      }

      setQuestions((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...res.question };
        try {
          localStorage.setItem(questionsStorageKey, JSON.stringify(next));
        } catch {
          // storage full or unavailable — in-memory state still updates fine
        }
        return next;
      });

      // A fresh resolve from brief/flag/draft supersedes any earlier
      // "pulled from previous cohort" tag on this row.
      if (previousMatches[index]) {
        const updated = { ...previousMatches };
        delete updated[index];
        persistPreviousMatches(updated);
      }

      setRow(index, {
        resolving: null,
        notice: null,
        snippet: mode === "from_brief" ? (res.source_snippet || null) : null
      });
    } catch (err) {
      console.error("Resolve failed:", err);
      setRow(index, { resolving: null, notice: describeError(err) });
    }
  };

  // ── Option 4: Pull from previous cohort — Repeat / Same-Cohort modes only.
  // No new backend endpoint needed: previous_cohort_context already carries
  // the previous opportunity's answers grouped by theme_code (Section 9.4). ──
  const handlePullFromPrevious = async (question, index) => {
    const bucket = context?.previous_cohort_context?.previous_answers_by_theme?.[question.theme_code] || [];
    const match =
      bucket.find((b) => b.answer && normalize(b.question) === normalize(question.question_text)) ||
      bucket.find((b) => b.answer);

    if (!match) {
      setRow(index, { notice: "No matching answer found in the previous cohort for this theme." });
      return;
    }

    setRow(index, { resolving: "pull_from_previous", notice: null });
    try {
      await updateQuestionAnswer(opportunityId, index, match.answer);
      setQuestions((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], answer_text: match.answer };
        try {
          localStorage.setItem(questionsStorageKey, JSON.stringify(next));
        } catch {
          // storage full or unavailable — in-memory state still updates fine
        }
        return next;
      });

      const cohortName = context?.previous_cohort_context?.previous_opportunity?.name || "previous cohort";
      const updatedMatches = {
        ...previousMatches,
        [index]: { cohortName, question: match.question, answer: match.answer }
      };
      persistPreviousMatches(updatedMatches);
      setRow(index, { resolving: null, notice: null });
    } catch (err) {
      console.error("Pull from previous failed:", err);
      setRow(index, { resolving: null, notice: describeError(err) });
    }
  };

  // Manual textarea edit
  const handleManualEdit = (index, value) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], answer_text: value };
      try {
        localStorage.setItem(questionsStorageKey, JSON.stringify(next));
      } catch {
        // storage full or unavailable — in-memory state still updates fine
      }
      return next;
    });
  };

  const handleManualEditBlur = async (index) => {
    try {
      await updateQuestionAnswer(opportunityId, index, questions[index].answer_text || "");
    } catch (err) {
      console.error("Failed to save answer:", describeError(err));
    }
  };

  // ── Per-theme Framework tag: applies to every question under that theme ──
  const handleThemeFrameworkSelect = (theme, framework) => {
    const updated = { ...themeFrameworks, [theme]: framework };
    if (framework === null) delete updated[theme];
    setThemeFrameworks(updated);
    setOpenThemeDropdown(null);
    try {
      localStorage.setItem(frameworkStorageKey, JSON.stringify(updated));
    } catch {
      // storage full or unavailable — tag still works for this session
    }
  };

  const indexOf = (q) => questions.indexOf(q);

  // ── Merge essentiality/suppression metadata from the context call onto the
  // saved questions, matched by normalized question text. Anything that can't
  // be matched defaults to "essential" so nothing silently disappears. ──
  const essentialityLookup = useMemo(() => {
    const map = {};
    (context?.suppression?.questions || []).forEach((sq) => {
      map[normalize(sq.question_text)] = {
        essentiality: sq.essentiality || "essential",
        rationale: sq.rationale,
        variant: sq.variant
      };
    });
    return map;
  }, [context]);

  const enrichedQuestions = useMemo(() => {
    return questions.map((q, index) => ({
      ...q,
      _index: index,
      essentiality: essentialityLookup[normalize(q.question_text)]?.essentiality || "essential"
    }));
  }, [questions, essentialityLookup]);

  // Group by essentiality band, then by theme within each band — matches
  // Section 12.1: "full read, grouped by essentiality then theme".
  const grouped = useMemo(() => {
    const byBand = { essential: {}, confirmation: {}, optional: {} };
    enrichedQuestions.forEach((q) => {
      const band = byBand[q.essentiality] ? q.essentiality : "essential";
      const theme = q.theme_code || "OTHER";
      if (!byBand[band][theme]) byBand[band][theme] = [];
      byBand[band][theme].push(q);
    });
    return byBand;
  }, [enrichedQuestions]);

  const suppressedCount = context?.suppression?.suppressed_count ?? 0;
  const suppressedAudit = (context?.suppression?.audit || []).filter((a) => a.suppression_reason);
  const programmeKind = context?.opportunity?.programme_kind || "new";
  const previousCohort = context?.previous_cohort_context || null;
  const showPreviousCohortPanel = programmeKind !== "new" && !!previousCohort;
  const totalCandidates = questions.length + suppressedCount;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#eef2ff", fontFamily: "Inter, sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ width: "240px", background: "white", borderRight: "1px solid #e2e8f0" }}>
        <div style={{ padding: "35px 25px" }}>
          <h1 style={{ color: "#2563eb", fontSize: "28px", fontWeight: "800" }}> Proposal<br />Intelligence</h1>
        </div>
        <div style={{ padding: "20px" }}>
          <div style={menuStyle} onClick={() => navigate("/new")}> New Opportunity</div>
          <div style={menuActive}> Questions</div>
          <div style={menuStyle} onClick={() => navigate("/mapping")}> Competency Mapping</div>
          <div style={menuStyle} onClick={() => navigate("/architecture")}> Architecture</div>
          <div style={menuStyle} onClick={() => navigate("/approach")}> Approach Note</div>
          <div style={menuStyle} onClick={() => navigate("/score")}> Proposal Score</div>
          <div style={{ ...menuStyle, marginTop: "40px", color: "#94a3b8" }} onClick={() => navigate("/dashboard")}>← Dashboard</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: "40px", display: "flex", gap: "24px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, background: "white", borderRadius: "28px", padding: "40px", border: "1px solid #dbe4ff", minWidth: 0 }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h1 style={{ fontSize: "42px", color: "#0f172a", fontWeight: "800" }}>Discovery Questions</h1>
            <button
              onClick={() => setLiveMode(!liveMode)}
              style={{ padding: "12px 20px", borderRadius: "12px", border: "1px solid #dbe4ff", background: liveMode ? "#2563eb" : "white", color: liveMode ? "white" : "#2563eb", fontWeight: "700", cursor: "pointer" }}
            >
              {liveMode ? " Live Mode ON" : " Live Mode OFF"}
            </button>
          </div>

          {/* ── SUPPRESSION COUNT BAR ──
              "N questions on this page · M auto-suppressed" with hover/click
              reveal of skipped questions and their reasons (Section 9/12.1). */}
          {!loading && questions.length > 0 && (
            <div style={{ position: "relative", marginBottom: "26px" }}>
              <div
                onClick={() => setSuppressionPanelOpen((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
                  padding: "12px 16px", borderRadius: "12px",
                  background: suppressedCount > 0 ? "#f5f3ff" : "#f8fafc",
                  border: `1px solid ${suppressedCount > 0 ? "#ddd6fe" : "#e2e8f0"}`,
                  cursor: suppressedCount > 0 ? "pointer" : "default"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={suppressedCount > 0 ? "#7c3aed" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#334155" }}>
                  {questions.length} question{questions.length === 1 ? "" : "s"} on this page
                  {programmeKind === "new" && ` of ${totalCandidates} candidates`}
                </span>
                {suppressedCount > 0 && (
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#7c3aed" }}>
                    · {suppressedCount} auto-suppressed
                  </span>
                )}
                {suppressedCount > 0 && (
                  <span style={{ fontSize: "12px", color: "#a78bfa", marginLeft: "auto" }}>
                    {suppressionPanelOpen ? "Hide reasons ▲" : "Why? ▼"}
                  </span>
                )}
                {programmeKind !== "new" && (
                  <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "auto" }}>
                    Fixed {programmeKind === "repeat" ? "Repeat" : "Same-Cohort"} question set — suppression rules don't apply
                  </span>
                )}
              </div>

              {suppressionPanelOpen && suppressedAudit.length > 0 && (
                <div style={{
                  marginTop: "8px", background: "white", border: "1px solid #ddd6fe", borderRadius: "12px",
                  padding: "6px", boxShadow: "0 10px 28px rgba(91,33,182,0.12)"
                }}>
                  {suppressedAudit.map((a, i) => (
                    <div key={i} style={{ padding: "10px 12px", borderBottom: i < suppressedAudit.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#7c5cd9", background: "#f5f3ff", padding: "2px 8px", borderRadius: "6px" }}>
                          {a.question_theme}
                        </span>
                        <span style={{ fontSize: "12.5px", color: "#334155", fontWeight: "500" }}>
                          {a.question_text_candidate || "Candidate question"}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                        Suppressed — {a.suppression_reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {contextError && (
                <p style={{ fontSize: "12px", color: "#b45309", marginTop: "6px" }}>{contextError}</p>
              )}
            </div>
          )}

          {loading && (
            <ProcessingState
              steps={[
                "Reviewing the brief",
                "Identifying themes to probe",
                "Drafting discovery questions",
                "Organising by category"
              ]}
              estimate="Usually takes 10-15 seconds"
            />
          )}

          {error && <div style={{ color: "red", padding: "20px", background: "#fef2f2", borderRadius: "12px", marginBottom: "20px" }}> {error}</div>}

          {!loading && questions.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "60px" }}>
              <p style={{ color: "#64748b", marginBottom: "20px" }}>No questions yet</p>
              <button onClick={() => loadQuestions(false)} style={{ padding: "14px 28px", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", border: "none", borderRadius: "12px", fontWeight: "700", cursor: "pointer" }}>
                Generate Questions 
              </button>
            </div>
          )}

          {/* ── ESSENTIALITY BANDS ── */}
          {ESSENTIALITY_ORDER.map((band) => {
            const themesInBand = grouped[band];
            const bandQuestionCount = Object.values(themesInBand).flat().length;
            if (bandQuestionCount === 0) return null;
            const meta = ESSENTIALITY_META[band];
            const answeredInBand = Object.values(themesInBand).flat().filter((q) => q.answer_text).length;

            return (
              <div key={band} style={{ marginBottom: "34px" }}>
                <div style={{
                  display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "6px",
                  paddingBottom: "10px", borderBottom: `2px solid ${meta.border}`
                }}>
                  <span style={{
                    fontSize: "13px", fontWeight: "800", color: meta.accent, background: meta.bg,
                    padding: "5px 14px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.04em"
                  }}>
                    {meta.label}
                  </span>
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                    {answeredInBand} of {bandQuestionCount} answered
                  </span>
                </div>
                <p style={{ fontSize: "12.5px", color: "#94a3b8", marginBottom: "16px" }}>{meta.blurb}</p>

                {Object.entries(themesInBand).map(([theme, qs]) => {
                  const themeFramework = themeFrameworks[theme];
                  const dropdownOpen = openThemeDropdown === `${band}:${theme}`;

                  return (
                    <div key={theme} style={{ marginBottom: "22px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                        <span style={{ padding: "6px 14px", background: THEME_COLORS[theme] || "#f1f5f9", borderRadius: "8px", fontSize: "13px", fontWeight: "500", color: "#334155" }}>{theme}</span>
                        <span style={{ fontSize: "16px", fontWeight: "500", color: "#0f172a" }}>{THEME_NAMES[theme] || theme}</span>
                        <span style={{ fontSize: "13px", color: "#94a3b8" }}>{qs.length} question{qs.length === 1 ? "" : "s"}</span>

                        {themeFramework && (
                          <span style={{
                            display: "flex", alignItems: "center", gap: "8px",
                            padding: "9px 18px", background: "#f5f3ff", color: "#5b21b6",
                            borderRadius: "10px", fontSize: "16px", fontWeight: "600",
                            border: "1.5px solid #ddd6fe"
                          }}>
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.611 1.611c-.47.47-1.087.706-1.704.706s-1.233-.235-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.611-1.611A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/>
                            </svg>
                            <span style={{ fontWeight: "400", color: "#7c5cd9" }}>Framework:</span>
                            {themeFramework}
                          </span>
                        )}

                        <div style={{ position: "relative", marginLeft: "auto" }}>
                          <button
                            onClick={() => setOpenThemeDropdown(dropdownOpen ? null : `${band}:${theme}`)}
                            aria-label="Set framework for this theme"
                            title="Set framework"
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              width: "36px", height: "36px",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: dropdownOpen ? "#f1f5f9" : "white",
                              color: "#64748b",
                              cursor: "pointer"
                            }}
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.611 1.611c-.47.47-1.087.706-1.704.706s-1.233-.235-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.611-1.611A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/>
                            </svg>
                          </button>

                          {dropdownOpen && (
                            <div style={{
                              position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20,
                              background: "white", border: "1px solid #e2e8f0", borderRadius: "10px",
                              boxShadow: "0 10px 28px rgba(15,23,42,0.12)", width: "230px", padding: "6px",
                              maxHeight: "280px", overflowY: "auto"
                            }}>
                              <div style={{ padding: "6px 10px 8px", fontSize: "11px", fontWeight: "500", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                Framework for {THEME_NAMES[theme] || theme}
                              </div>
                              {FRAMEWORK_OPTIONS.map((fw) => {
                                const selected = fw === themeFramework;
                                return (
                                  <div
                                    key={fw}
                                    onClick={() => handleThemeFrameworkSelect(theme, fw)}
                                    style={{
                                      display: "flex", alignItems: "center", justifyContent: "space-between",
                                      padding: "8px 10px", borderRadius: "6px", fontSize: "13.5px",
                                      color: selected ? "#5b21b6" : "#334155",
                                      background: selected ? "#f5f3ff" : "transparent",
                                      fontWeight: selected ? "500" : "400",
                                      cursor: "pointer"
                                    }}
                                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "#f8fafc"; }}
                                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
                                  >
                                    {fw}
                                    {selected && <span style={{ fontSize: "12px" }}>✓</span>}
                                  </div>
                                );
                              })}
                              {themeFramework && (
                                <div
                                  onClick={() => handleThemeFrameworkSelect(theme, null)}
                                  style={{ padding: "8px 10px", borderRadius: "6px", fontSize: "13.5px", color: "#dc2626", cursor: "pointer", borderTop: "1px solid #f1f5f9", marginTop: "4px" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  Remove framework
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {qs.map((q) => {
                        const index = q._index !== undefined ? q._index : indexOf(q);
                        const rs = rowState[index] || {};
                        const sourceTag = SOURCE_LABEL[q.answer_source] || (previousMatches[index] ? SOURCE_LABEL.pull_from_previous : null);
                        const pulledMatch = previousMatches[index];

                        return (
                          <div key={index} style={{ background: "#f8fafc", borderRadius: "16px", padding: "20px", marginBottom: "12px", border: `1px solid ${ESSENTIALITY_META[band].border}` }}>

                            <p style={{ fontWeight: "600", color: "#0f172a", marginBottom: "14px", fontSize: "15px" }}>{q.question_text}</p>

                            {/* ── Resolver buttons: 3 always, 4th only in Repeat / Same-Cohort ── */}
                            <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                              <button
                                disabled={!!rs.resolving}
                                onClick={() => handleResolve(q, index, "from_brief")}
                                style={optionBtnStyle(q.answer_source === "from_brief")}
                              >
                                {rs.resolving === "from_brief" ? "Checking brief..." : " Found in client requirement"}
                              </button>
                              <button
                                disabled={!!rs.resolving}
                                onClick={() => handleResolve(q, index, "flagged_to_client")}
                                style={optionBtnStyle(q.answer_source === "flagged_to_client")}
                              >
                                Not found — flag to client
                              </button>
                              <button
                                disabled={!!rs.resolving}
                                onClick={() => handleResolve(q, index, "draft_assumption")}
                                style={optionBtnStyle(q.answer_source === "draft_assumption")}
                              >
                                {rs.resolving === "draft_assumption" ? "Drafting..." : " First-draft assumption"}
                              </button>

                              {showPreviousCohortPanel && (
                                <button
                                  disabled={!!rs.resolving}
                                  onClick={() => handlePullFromPrevious(q, index)}
                                  style={optionBtnStyle(!!pulledMatch, "#0e7490")}
                                  title="Pull the answer this cohort gave to the same or an equivalent question"
                                >
                                  {rs.resolving === "pull_from_previous" ? "Pulling..." : " Pull from previous cohort"}
                                </button>
                              )}
                            </div>

                            {rs.notice && (
                              <div style={{ fontSize: "12px", color: "#b45309", background: "#fffbeb", padding: "8px 12px", borderRadius: "8px", marginBottom: "10px" }}>
                                 {rs.notice}
                              </div>
                            )}

                            {/* ── Provenance chip — every auto-populated answer carries one ── */}
                            {sourceTag && (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                <span style={{ display: "inline-block", fontSize: "11px", fontWeight: "700", color: sourceTag.color, background: sourceTag.bg, border: `1px solid ${sourceTag.border}`, padding: "3px 10px", borderRadius: "20px" }}>
                                  {sourceTag.text}
                                  {pulledMatch && `: ${pulledMatch.cohortName}`}
                                </span>
                                {pulledMatch && (
                                  <button
                                    onClick={() => setDrawerIndex(index)}
                                    style={{ fontSize: "11px", color: "#0e7490", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 }}
                                  >
                                    View original answer
                                  </button>
                                )}
                                {!pulledMatch && q.answer_source === "from_brief" && rs.snippet && (
                                  <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }} title={rs.snippet}>
                                    "{rs.snippet.length > 60 ? rs.snippet.slice(0, 60) + "…" : rs.snippet}"
                                  </span>
                                )}
                              </div>
                            )}

                            <textarea
                              value={q.answer_text || ""}
                              onChange={(e) => handleManualEdit(index, e.target.value)}
                              onBlur={() => handleManualEditBlur(index)}
                              placeholder="Answer will appear here once resolved — or type it manually..."
                              rows={2}
                              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", marginTop: "4px", resize: "vertical", fontFamily: "inherit" }}
                            />

                            {liveMode && (
                              <textarea
                                placeholder="Live call notes — type client answer here as they speak..."
                                rows={2}
                                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", marginTop: "8px", resize: "vertical", fontFamily: "inherit", background: "#fefce8" }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {questions.length > 0 && (
            <div style={{ display: "flex", gap: "16px", marginTop: "30px" }}>
              <button onClick={() => navigate("/mapping")} style={{ flex: 1, padding: "16px", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", border: "none", borderRadius: "14px", fontWeight: "700", fontSize: "16px", cursor: "pointer" }}>
                Next → Competency Mapping
              </button>
            </div>
          )}

        </div>

        {/* ── PREVIOUS COHORT CONTEXT PANEL ──
            Repeat / Same-Cohort modes only. Slims to a dropdown in Live Mode
            per Section 10.3 ("right rail collapses to give answer fields
            maximum width"). */}
        {showPreviousCohortPanel && (
          <div style={{ width: liveMode ? "220px" : "300px", flexShrink: 0 }}>
            <div style={{ background: "white", borderRadius: "20px", border: "1px solid #a5f3fc", overflow: "hidden" }}>
              <div
                onClick={() => liveMode && setCohortPanelCollapsed((v) => !v)}
                style={{
                  padding: "18px 20px", background: "#ecfeff", borderBottom: "1px solid #a5f3fc",
                  cursor: liveMode ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center"
                }}
              >
                <div>
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#0e7490", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {programmeKind === "repeat" ? "Previous Cohort" : "Prior Engagement"}
                  </p>
                  <p style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>
                    {previousCohort.previous_opportunity?.name || "Unnamed cohort"}
                  </p>
                </div>
                {liveMode && <span style={{ color: "#0e7490", fontSize: "13px" }}>{cohortPanelCollapsed ? "▼" : "▲"}</span>}
              </div>

              {!(liveMode && cohortPanelCollapsed) && (
                <div style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                    {previousCohort.previous_nps !== null && previousCohort.previous_nps !== undefined && (
                      <div style={{ flex: 1, background: "#f0fdfa", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                        <p style={{ fontSize: "20px", fontWeight: "800", color: "#0e7490" }}>{previousCohort.previous_nps}</p>
                        <p style={{ fontSize: "10.5px", color: "#64748b" }}>Previous NPS</p>
                      </div>
                    )}
                    {previousCohort.previous_opportunity?.duration && (
                      <div style={{ flex: 1, background: "#f8fafc", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                        <p style={{ fontSize: "20px", fontWeight: "800", color: "#334155" }}>{previousCohort.previous_opportunity.duration}d</p>
                        <p style={{ fontSize: "10.5px", color: "#64748b" }}>Duration</p>
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: "11.5px", fontWeight: "700", color: "#16a34a", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>Top positives</p>
                  {previousCohort.previous_top_positives?.length > 0 ? (
                    <ul style={{ fontSize: "12.5px", color: "#334155", paddingLeft: "18px", marginBottom: "14px" }}>
                      {previousCohort.previous_top_positives.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  ) : (
                    <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "14px" }}>No feedback captured yet for this cohort.</p>
                  )}

                  <p style={{ fontSize: "11.5px", fontWeight: "700", color: "#dc2626", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>Top critiques</p>
                  {previousCohort.previous_top_critiques?.length > 0 ? (
                    <ul style={{ fontSize: "12.5px", color: "#334155", paddingLeft: "18px", marginBottom: "14px" }}>
                      {previousCohort.previous_top_critiques.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  ) : (
                    <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "14px" }}>No feedback captured yet for this cohort.</p>
                  )}

                  {previousCohort.previous_decision_makers?.length > 0 && (
                    <>
                      <p style={{ fontSize: "11.5px", fontWeight: "700", color: "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>Stakeholders</p>
                      <ul style={{ fontSize: "12.5px", color: "#334155", paddingLeft: "18px", marginBottom: "4px" }}>
                        {previousCohort.previous_decision_makers.map((d, i) => <li key={i}>{d.name}{d.role ? ` — ${d.role}` : ""}</li>)}
                      </ul>
                    </>
                  )}

                  <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                    Full previous-proposal viewer isn't wired up yet — this panel shows what's on the linked opportunity record.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── "Pull from previous cohort" drawer — Section 9.4: the pulled answer
          "arrives pre-populated with a provenance chip ... and lets the user
          open it in a side drawer." ── */}
      {drawerIndex !== null && previousMatches[drawerIndex] && (
        <div
          onClick={() => setDrawerIndex(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "380px", height: "100%", background: "white", padding: "28px", boxShadow: "-10px 0 30px rgba(15,23,42,0.15)", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
              <p style={{ fontSize: "11px", fontWeight: "700", color: "#0e7490", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                From {previousMatches[drawerIndex].cohortName}'s discovery answers
              </p>
              <button onClick={() => setDrawerIndex(null)} style={{ border: "none", background: "none", fontSize: "18px", cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>
            <p style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>Original question</p>
            <p style={{ fontSize: "13.5px", color: "#475569", marginBottom: "20px" }}>{previousMatches[drawerIndex].question}</p>
            <p style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>Original answer</p>
            <p style={{ fontSize: "13.5px", color: "#475569", background: "#ecfeff", padding: "12px", borderRadius: "10px" }}>{previousMatches[drawerIndex].answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const optionBtnStyle = (active, activeColor = "#2563eb") => ({
  padding: "8px 14px",
  borderRadius: "10px",
  border: active ? `1px solid ${activeColor}` : "1px solid #cbd5e1",
  background: active ? activeColor : "white",
  color: active ? "white" : "#334155",
  fontWeight: "600",
  fontSize: "12.5px",
  cursor: "pointer",
  whiteSpace: "nowrap"
});

const menuStyle = { padding: "14px 16px", borderRadius: "14px", cursor: "pointer", marginBottom: "10px", fontWeight: "600", color: "#475569", fontSize: "15px" };
const menuActive = { padding: "14px 16px", borderRadius: "14px", background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", marginBottom: "10px", fontWeight: "700", fontSize: "15px" };
