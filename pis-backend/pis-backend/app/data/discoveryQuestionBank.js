// ── DISCOVERY QUESTIONS: QUESTION BANK ───────────────
// Static, spec-defined question content. No LLM calls here — question TEXT
// is fixed per PIS_Discovery_Questions_Build_Spec_v2, Sections 4 (New
// Programme baseline, Q1-Q8), 5 (Repeat, R1-R5), and 6 (New Content / Same
// Cohort, S1-S6). The suppression engine decides WHICH of these survive for
// a given opportunity; this file only holds what they say.
//
// theme_code assignments for R1-R5 and S1-S6 are not explicitly given in the
// spec (only the New Programme set has documented theme codes) — they're a
// reasonable best-fit mapping onto the same 8 themes used elsewhere on this
// page, so Repeat/Same-Cohort questions still group sensibly by theme in the
// UI. Adjust if the actual spec authors intended different groupings.

const NEW_PROGRAMME_QUESTIONS = [
  {
    id: 'Q1',
    theme_code: 'BCS',
    question_text: 'What decision, incident, or planning cycle inside your business made this the moment to invest in this programme?',
    rationale: 'The strategic trigger is different from the stated rationale. It is the specific event that moved this from a shortlist to a live commission, and it becomes the opening paragraph of the Approach Note.',
    downstream_use: 'Approach Note opening; Proposal Scoring rewards specificity of business narrative.'
  },
  {
    id: 'Q2',
    theme_code: 'AUD',
    question_text: 'Are there political sensitivities inside this cohort we should design around? Reporting lines, unresolved conflicts, planned reorganisations, active talent decisions.',
    rationale: 'Audience characteristics are captured on Page 1, but the human weather inside the cohort never is. This shapes seating, peer grouping, action-learning team composition, and sometimes case selection.',
    downstream_use: 'Programme Architecture peer grouping and cohort split decisions; Approach Note sensitivity notes.'
  },
  {
    id: 'Q3',
    theme_code: 'BAS',
    question_text: 'What has this audience already been exposed to on this topic, from you or from other providers, and how did each engagement land?',
    rationale: 'Anchors the entry point for the programme. Prior L&D history is rarely written into a brief and is the single most useful piece of information a learning architect can hold.',
    downstream_use: 'Architecture entry-point calibration; Module Recommender excludes modules that revisit content the cohort has recently done well.'
  },
  {
    id: 'Q4',
    theme_code: 'BEH',
    question_text: 'Describe one participant, twelve weeks after the programme ends, doing something differently in their real job. Be as specific as you can about the behaviour.',
    rationale: 'Converts generic goal statements into observable, testable acts. Goals in briefs are almost always at the capability level; the client rarely translates them into behaviours until asked.',
    downstream_use: 'Architecture reinforcement design, action-learning framing, measurement approach; Approach Note lifts examples as proof points.'
  },
  {
    id: 'Q5',
    theme_code: 'PED',
    question_text: 'What faculty archetype resonates with this audience? Academic depth, practitioner storytelling, coach, provocateur, or a specific mix.',
    rationale: 'Faculty style is a separate axis from delivery format and almost never appears in briefs. Getting this wrong wastes scarce senior faculty time.',
    downstream_use: 'Faculty assignment in the Programme Architecture stage; Approach Note faculty bench narrative.'
  },
  {
    id: 'Q6',
    theme_code: 'PED',
    question_text: 'Are there topics, methodologies, cases, or exercises we should deliberately avoid?',
    rationale: 'The exclusion list is worth as much as the inclusion list, and is never volunteered in briefs or RFPs.',
    downstream_use: 'Module Recommender filters; Architecture case selection; Faculty short-listing.'
  },
  {
    id: 'Q7',
    theme_code: 'DEC',
    question_text: 'Who signs off on this proposal, who can veto it, and what does each of them need to see for it to land?',
    rationale: 'Converts the Page 1 Stakeholder Map into an actual decision workflow. The map gives names and roles, not decision behaviour.',
    downstream_use: 'Approach Note structure and emphasis; Proposal Scoring completeness check.'
  },
  {
    id: 'Q8',
    theme_code: 'FOL',
    question_text: 'Twelve months after the programme ends, who is looking at what to decide whether it worked? Please name the person and the metric or artefact.',
    rationale: 'Forces the client to declare an owner and a measurement instrument before design begins. Even mature L&D functions rarely document this in a brief.',
    downstream_use: 'Architecture measurement layer; sustainment design; Approach Note evaluation section.'
  }
];

const REPEAT_QUESTIONS = [
  {
    id: 'R1',
    theme_code: 'BCS',
    question_text: 'What has changed in the business context since the last cohort ran?',
    rationale: 'Leadership changes, strategy resets, market events, a merger, a new competitive threat, or a regulatory shift all change the opening narrative.',
    downstream_use: 'Approach Note context refresh; Architecture stage retains most modules but may swap in newer cases.'
  },
  {
    id: 'R2',
    theme_code: 'PED',
    question_text: "Looking at the previous cohort's feedback, what do you want us to preserve and what do you want us to change?",
    rationale: "Deliberately open-ended because 'preserve' and 'change' are the two axes that matter. The previous cohort's NPS and top feedback are shown in the previous cohort panel while answering.",
    downstream_use: 'Module Recommender adjusts weightings; Architecture retains modules marked preserve, considers alternatives for modules marked change.'
  },
  {
    id: 'R3',
    theme_code: 'AUD',
    question_text: 'Is the audience profile identical to last time, or has it shifted in seniority, function, geography, or size?',
    rationale: 'A repeat programme rarely runs for exactly the same profile. Cohort size, geography, and seniority can all shift between runs.',
    downstream_use: 'Architecture cohort design; Faculty assignment revalidation.'
  },
  {
    id: 'R4',
    theme_code: 'DEC',
    question_text: 'Are the decision-makers on this proposal the same people as last time? If not, who is new and what do they care about?',
    rationale: 'Sponsors turn over. A new decision-maker reads proposals differently from their predecessor, even when the programme itself is unchanged.',
    downstream_use: 'Approach Note structural adjustment; Stakeholder Map refresh.'
  },
  {
    id: 'R5',
    theme_code: 'CON',
    question_text: 'Do you want us to bring in new faculty, new methods, or new content this time, or refine what worked?',
    rationale: "The single most useful signal for scoping the design effort. 'Refine what worked' is a short engagement; 'bring in new faculty and rework a module' is a materially longer one.",
    downstream_use: 'Architecture change-scope estimate; Module Recommender activation of new candidates; Faculty short-list refresh.'
  }
];

const SAME_COHORT_QUESTIONS = [
  {
    id: 'S1',
    theme_code: 'BAS',
    question_text: 'What did the previous programme with this cohort cover, and at what capability level did participants leave?',
    rationale: 'Pre-populated from previous_architecture_summary where possible. The observed post-programme capability is often more useful than what the previous programme intended to deliver.',
    downstream_use: 'Architecture entry-point calibration for the new programme; Module Recommender exclusion of already-covered modules.'
  },
  {
    id: 'S2',
    theme_code: 'BCS',
    question_text: 'How does this new programme relate to the previous one? Extension, adjacent capability, entirely different domain, or remediation.',
    rationale: 'The relationship shapes the narrative and the design. An extension inherits language and cases; remediation is rare but real when a previous programme did not land.',
    downstream_use: 'Architecture narrative choice; Approach Note framing.'
  },
  {
    id: 'S3',
    theme_code: 'BCS',
    question_text: 'What decision or moment made this the next thing you want them to work on?',
    rationale: 'The same trigger question as Q1 in the New Programme set, framed for the follow-on context.',
    downstream_use: 'Approach Note opening; Architecture urgency framing.'
  },
  {
    id: 'S4',
    theme_code: 'PED',
    question_text: 'Are there content areas we should deliberately not repeat from the previous programme?',
    rationale: 'A sharp version of the exclusion question. Prevents an embarrassing overlap when the client reads the draft architecture.',
    downstream_use: 'Module Recommender exclusion filters; Architecture case selection.'
  },
  {
    id: 'S5',
    theme_code: 'AUD',
    question_text: "Has the group's dynamic changed since the last programme? Departures, new joiners, changed reporting lines.",
    rationale: 'Same-cohort programmes are vulnerable to cohort erosion. The portion that has changed needs onboarding into an existing dynamic.',
    downstream_use: 'Architecture opening block design; peer grouping revalidation.'
  },
  {
    id: 'S6',
    theme_code: 'FOL',
    question_text: "Twelve months after this next programme, what will you and the cohort's line managers be looking for as evidence it worked?",
    rationale: 'The Kirkpatrick question, framed for the follow-on. Same-cohort programmes often benefit from a stronger measurement plan because baseline data already exists.',
    downstream_use: 'Architecture measurement layer; sustainment design; Approach Note evaluation section.'
  }
];

// ── Public API ──
// programme_kind: 'new' | 'repeat' | 'new_content_same_cohort'
const getQuestionSet = (programme_kind) => {
  if (programme_kind === 'repeat') return REPEAT_QUESTIONS;
  if (programme_kind === 'new_content_same_cohort') return SAME_COHORT_QUESTIONS;
  return NEW_PROGRAMME_QUESTIONS;
};

module.exports = {
  getQuestionSet,
  NEW_PROGRAMME_QUESTIONS,
  REPEAT_QUESTIONS,
  SAME_COHORT_QUESTIONS
};