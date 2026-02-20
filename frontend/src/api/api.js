import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', new URLSearchParams(credentials), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

export const adminAPI = {
  createBranch: (data) => api.post('/admin/branches', data),
  getBranches: () => api.get('/admin/branches'),
  updateBranch: (id, data) => api.put(`/admin/branches/${id}`, data),
  deleteBranch: (id) => api.delete(`/admin/branches/${id}`),
  createProgram: (data) => api.post('/admin/programs', data),
  getPrograms: () => api.get('/programs'),
  updateProgram: (id, data) => api.put(`/admin/programs/${id}`, data),
  deleteProgram: (id) => api.delete(`/admin/programs/${id}`),
  createUser: (data) => api.post('/admin/users', data),
  getUsers: () => api.get('/admin/users'),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
};

export const leadsAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return api.get(`/leads?${params.toString()}`);
  },
  getOne: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
  getFollowups: (id) => api.get(`/leads/${id}/followups`),
};

export const followupAPI = {
  create: (data) => api.post('/followups', data),
  getPending: () => api.get('/followups/pending'),
  getPendingCount: () => api.get('/followups/pending/count'),
  updateStatus: (id, status) => api.put(`/followups/${id}/status`, null, { params: { status } }),
};

export const analyticsAPI = {
  getOverview: () => api.get('/analytics/overview'),
  getBranchWise: () => api.get('/analytics/branch-wise'),
};

export const reportsAPI = {
  generateLeadsReport: (filters = {}) => {
    const params = new URLSearchParams({ ...filters, format: 'csv' });
    return api.get(`/reports/leads?${params.toString()}`, {
      responseType: 'blob'
    });
  },
};

export default api;
