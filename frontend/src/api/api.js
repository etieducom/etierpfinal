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
  delete: (id, data = {}) => api.delete(`/leads/${id}`, { data }),
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
  getMonthlyFinancial: (year) => api.get(`/analytics/financial/monthly${year ? `?year=${year}` : ''}`),
  getBranchWiseFinancial: () => api.get('/analytics/financial/branch-wise'),
  getSuperAdminDashboard: () => api.get('/analytics/super-admin-dashboard'),
};

export const whatsappAPI = {
  getSettings: () => api.get('/admin/whatsapp-settings'),
  updateSettings: (data) => api.put('/admin/whatsapp-settings', data),
};

export const resourcesAPI = {
  getAll: () => api.get('/resources'),
  create: (data) => api.post('/admin/resources', data),
  delete: (id) => api.delete(`/admin/resources/${id}`),
};

export const reportsAPI = {
  generateLeadsReport: (filters = {}) => {
    const params = new URLSearchParams({ ...filters, format: 'csv' });
    return api.get(`/reports/leads?${params.toString()}`, {
      responseType: 'blob'
    });
  },
};

export const expenseAPI = {
  createCategory: (data) => api.post('/admin/expense-categories', data),
  deleteCategory: (id) => api.delete(`/admin/expense-categories/${id}`),
  getCategories: () => api.get('/expense-categories'),
  createExpense: (data) => api.post('/expenses', data),
  getExpenses: () => api.get('/expenses'),
  deleteExpense: (id) => api.delete(`/expenses/${id}`),
};

export const leadSourceAPI = {
  getAll: () => api.get('/lead-sources'),
  create: (data) => api.post('/admin/lead-sources', data),
  delete: (id) => api.delete(`/admin/lead-sources/${id}`),
};

export const enrollmentAPI = {
  getConvertedLeads: () => api.get('/leads/converted'),
  createEnrollment: (data) => api.post('/enrollments', data),
  getEnrollments: () => api.get('/enrollments'),
  getEnrollmentPayments: (id) => api.get(`/enrollments/${id}/payments`),
  getPaymentPlan: (id) => api.get(`/enrollments/${id}/payment-plan`),
};

export const paymentAPI = {
  createPaymentPlan: (data) => api.post('/payment-plans', data),
  createPayment: (data) => api.post('/payments', data),
  generateReceipt: (paymentId) => api.get(`/payments/${paymentId}/receipt`),
  getAllPayments: (params = {}) => api.get('/payments/all', { params }),
  getPendingPayments: (params = {}) => api.get('/payments/pending', { params }),
  deletePayment: (id) => api.delete(`/payments/${id}`),
  updatePayment: (id, data) => api.put(`/payments/${id}`, data),
};

export const deletedLeadsAPI = {
  getDeleted: () => api.get('/leads/deleted'),
};

export default api;
