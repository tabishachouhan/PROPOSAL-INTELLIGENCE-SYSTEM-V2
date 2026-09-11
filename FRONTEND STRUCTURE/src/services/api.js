import axios from 'axios';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  'https://proposal-intelligence-system-v2-1-eroi.onrender.com'
).replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pis_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const loginUser = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
};

export const signupUser = async (data) => {
  const res = await api.post('/auth/signup', data);
  return res.data;
};

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

export const generateQuestions = async (id) => {
  const res = await api.post(`/opportunities/${id}/questions`);
  return res.data;
};

export const getQuestionsContext = async (id) => {
  const res = await api.get(`/opportunities/${id}/questions/context`);
  return res.data;
};

export const resolveAnswer = async (opportunityId, questionIndex, mode) => {
  const res = await api.post(`/opportunities/${opportunityId}/questions/${questionIndex}/resolve`, { mode });
  return res.data;
};

export const updateQuestionAnswer = async (opportunityId, questionIndex, answer_text) => {
  const res = await api.patch(`/opportunities/${opportunityId}/questions/${questionIndex}`, { answer_text });
  return res.data;
};

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

export const buildArchitecture = async (id, force = false, designParameters = null) => {
  const res = await api.post(
    `/opportunities/${id}/architecture${force ? '?regenerate=true' : ''}`,
    designParameters ? { design_parameters: designParameters } : {}
  );
  return res.data;
};

export const writeApproachNote = async (id) => {
  const res = await api.post(`/opportunities/${id}/approach-note`);
  return res.data;
};

export const scoreProposal = async (id, force = false) => {
  const res = await api.post(`/opportunities/${id}/score${force ? '?regenerate=true' : ''}`);
  return res.data;
};

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

export const saveCompetencyDecision = async (opportunityId, competencyId, decision) => {
  const res = await api.patch(
    `/opportunities/${opportunityId}/competencies/${competencyId}/decision`,
    { decision }
  );
  return res.data;
};
export const analyseBrief = createOpportunity;

// Downloads the opportunity's approach note as a .pptx file.
// Returns nothing — it directly triggers the browser download.
export const downloadApproachNotePpt = async (id, clientName = 'Proposal') => {
  const res = await api.get(`/opportunities/${id}/approach-note/ppt`, {
    responseType: 'blob'
  });

  const safeName = (clientName || 'Proposal').replace(/[^a-z0-9]/gi, '_');
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${safeName}_Approach_Note.pptx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default api;
