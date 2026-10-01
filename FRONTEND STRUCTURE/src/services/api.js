import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api',
  headers: { 'Content-Type': 'application/json' }
});

// ── Auto-attach token to every request ──────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pis_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── AUTH ─────────────────────────────────────────
export const loginUser = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
};

export const signupUser = async (data) => {
  const res = await api.post('/auth/signup', data);
  return res.data;
};

// ── OPPORTUNITIES ────────────────────────────────
export const createOpportunity = async (data) => {
  const res = await api.post('/opportunities', data);
  return res.data;
};

export const getOpportunities = async () => {
  const res = await api.get('/opportunities');
  return res.data;
};

export const getOpportunity = async (id) => {
  const res = await api.get(`/opportunities/${id}`);
  return res.data;
};

// ── AI AGENTS ────────────────────────────────────
export const generateQuestions = async (id) => {
  const res = await api.post(`/opportunities/${id}/questions`);
  return res.data;
};

// Essentiality bands, suppression decisions + audit trail, and (for Repeat /
// Same-Cohort modes) the previous_cohort_context block. Backed by
// GET /opportunities/:id/questions/context — see questionsContextService.js.
export const getQuestionsContext = async (id) => {
  const res = await api.get(`/opportunities/${id}/questions/context`);
  return res.data;
};

// ── ANSWER COLUMN (3-option resolver) ────────────
// mode: 'from_brief' | 'flagged_to_client' | 'draft_assumption'
export const resolveAnswer = async (opportunityId, questionIndex, mode) => {
  const res = await api.post(`/opportunities/${opportunityId}/questions/${questionIndex}/resolve`, { mode });
  return res.data;
};

// Manual edit of the answer text box (used after auto-fill too)
export const updateQuestionAnswer = async (opportunityId, questionIndex, answer_text) => {
  const res = await api.patch(`/opportunities/${opportunityId}/questions/${questionIndex}`, { answer_text });
  return res.data;
};

// ── FRAMEWORK BUTTON ──────────────────────────────
export const setQuestionFramework = async (opportunityId, questionIndex, framework_used) => {
  const res = await api.patch(`/opportunities/${opportunityId}/questions/${questionIndex}/framework`, { framework_used });
  return res.data;
};

export const mapCompetencies = async (id, force = false) => {
  const res = await api.post(`/opportunities/${id}/competencies${force ? '?remap=true' : ''}`);
  return res.data;
};

export const recommendModules = async (id) => {
  const res = await api.post(`/opportunities/${id}/modules`);
  return res.data;
};

export const buildArchitecture = async (id, force = false) => {
  const res = await api.post(`/opportunities/${id}/architecture${force ? '?regenerate=true' : ''}`);
  return res.data;
};

export const writeApproachNote = async (id) => {
  const res = await api.post(`/opportunities/${id}/approach-note`);
  return res.data;
};

// ── DOWNLOAD APPROACH NOTE AS POWERPOINT ─────────
// File name always comes from THIS opportunity's client name (fetched from the
// server), never from a stale value in localStorage.
export const downloadApproachNotePpt = async (id, clientName = 'Proposal') => {
  let name = clientName;
  try {
    const opp = await api.get(`/opportunities/${id}`);
    // server responds { success: true, data: <opportunity> }
    name = opp.data?.data?.client_name || clientName;
  } catch (e) {
    // fall back to the name passed in
  }

  const res = await api.get(`/opportunities/${id}/approach-note/ppt`, { responseType: 'blob' });
  const safeName = (name || 'Proposal').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Proposal';
  const url = window.URL.createObjectURL(new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}_Approach_Note.pptx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const scoreProposal = async (id, force = false) => {
  const res = await api.post(`/opportunities/${id}/score${force ? '?regenerate=true' : ''}`);
  return res.data;
};

// ── COMPETENCY FRAMEWORK ──────────────────────────
export const getCompetencyFramework = async () => {
  const res = await api.get('/competencies');
  return res.data;
};

export const uploadCompetencyFramework = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/competencies/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const resetCompetencyFramework = async () => {
  const res = await api.post('/competencies/reset');
  return res.data;
};

// ── COMPETENCY DECISIONS ──────────────────────────
export const saveCompetencyDecision = async (opportunityId, competencyId, decision) => {
  const res = await api.patch(
    `/opportunities/${opportunityId}/competencies/${competencyId}/decision`,
    { decision }
  );
  return res.data;
};

// ── Alias ────────────────────────────────────────
export const analyseBrief = createOpportunity;

export default api;