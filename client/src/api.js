import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const register = (data) => api.post('/auth/register', data).then((r) => r.data);
export const login = (data) => api.post('/auth/login', data).then((r) => r.data);
export const changePassword = (data) => api.put('/auth/change-password', data).then((r) => r.data);
export const updateAvatar = (avatar) => api.patch('/auth/avatar', { avatar }).then((r) => r.data);

// CV (client)
export const generateCvWithAi = (data) => api.post('/cv/generate', data).then((r) => r.data);
export const saveCV = (data) => api.post('/cv', data).then((r) => r.data);
export const listCVs = () => api.get('/cv').then((r) => r.data);
export const getCV = (id) => api.get(`/cv/${id}`).then((r) => r.data);
export const updateCV = (id, data) => api.put(`/cv/${id}`, data).then((r) => r.data);
export const deleteCV = (id) => api.delete(`/cv/${id}`).then((r) => r.data);
export const updateCVStatus = (id, status) =>
  api.post(`/cv/${encodeURIComponent(String(id))}/status`, { application_status: status }).then((r) => r.data);
export const downloadDocxUrl = (id) => `/api/cv/${id}/download/docx`;
export const downloadPdfUrl = (id) => `/api/cv/${id}/download/pdf`;
export const downloadCoverLetterPdfUrl = (id) => `/api/cv/${id}/download/cover-letter/pdf`;

// AI assistant
export const cvChat = ({ cvId, message, history }) =>
  api.post('/ai/cv-chat', { cvId, message, history }).then((r) => r.data);

// Profile
export const listProfiles = () => api.get('/profile').then((r) => r.data);
export const getProfileById = (id) => api.get(`/profile/${id}`).then((r) => r.data);
export const createProfile = (data) => api.post('/profile', data).then((r) => r.data);
export const updateProfile = (id, data) => api.put(`/profile/${id}`, data).then((r) => r.data);
export const deleteProfile = (id) => api.delete(`/profile/${id}`).then((r) => r.data);

// Templates
export const listTemplates = () => api.get('/template').then((r) => r.data);
export const getTemplate = (id) => api.get(`/template/${id}`).then((r) => r.data);

// Workspace (saved hyperlinks from uploads)
export const listWorkspaceLinks = (params) =>
  api.get('/workspace-links', { params }).then((r) => r.data);
export const saveWorkspaceLinks = (data) => api.post('/workspace-links', data).then((r) => r.data);
export const deleteWorkspaceLinks = (ids) =>
  api.post('/workspace-links/delete-batch', { ids }).then((r) => r.data);
export const setProfileForWorkspaceLinks = ({ ids, profileId }) =>
  api.post('/workspace-links/set-profile', { ids, profileId }).then((r) => r.data);
export const setJobDescriptionForWorkspaceLink = ({ id, jobDescription }) =>
  api.post('/workspace-links/set-jd', { id, jobDescription }).then((r) => r.data);
export const generateCvsForWorkspaceLinks = ({ ids, profileId, jobDescriptionsByLinkId }) =>
  api.post('/workspace-links/generate-cvs', { ids, profileId, jobDescriptionsByLinkId }).then((r) => r.data);

// Admin
export const adminStats = () => api.get('/admin/stats').then((r) => r.data);
export const adminListUsers = () => api.get('/admin/users').then((r) => r.data);
export const adminToggleApprove = (id) => api.put(`/admin/users/${id}/approve`).then((r) => r.data);
export const adminListCVs = () => api.get('/admin/cvs').then((r) => r.data);
export const adminGetUserCVs = (id) => api.get(`/admin/users/${id}/cvs`).then((r) => r.data);
export const adminGetUserProfiles = (id) => api.get(`/admin/users/${id}/profiles`).then((r) => r.data);
