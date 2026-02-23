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
  changePassword: (data) => api.put('/auth/change-password', data),
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
  getBranchUsers: () => api.get('/branch/users'),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  changeUserPassword: (id, data) => api.put(`/admin/users/${id}/password`, data),
  updateUserStatus: (id, data) => api.put(`/admin/users/${id}/status`, data),
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

export const uploadAPI = {
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
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
  generateReport: (filters = {}) => {
    const params = new URLSearchParams({ ...filters, format: 'csv' });
    return api.get(`/reports/generate?${params.toString()}`, {
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

export const studentsAPI = {
  getAll: () => api.get('/students'),
  getDetails: (id) => api.get(`/students/${id}`),
  cancelEnrollment: (id, reason) => api.put(`/students/${id}/cancel`, null, { params: { reason } }),
  updateStatus: (id, status, reason) => api.put(`/students/${id}/status`, null, { params: { status, reason } }),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  send: (data) => api.post('/notifications', data),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

export const followupAPI = {
  create: (data) => api.post('/followups', data),
  getPending: () => api.get('/followups/pending'),
  getPendingCount: () => api.get('/followups/pending/count'),
  updateStatus: (id, status) => api.put(`/followups/${id}/status`, null, { params: { status } }),
  getDueSoon: () => api.get('/followups/due-soon'),
  getOverdue: () => api.get('/followups/overdue'),
};

export const pushSubscriptionAPI = {
  getVapidKey: () => api.get('/push-subscriptions/vapid-public-key'),
  subscribe: (data) => api.post('/push-subscriptions', data),
  unsubscribe: () => api.delete('/push-subscriptions'),
};

export const webhookAPI = {
  getBranchWebhookInfo: (branchId) => api.get(`/admin/branches/${branchId}/webhook-info`),
  regenerateWebhookKey: (branchId) => api.post(`/admin/branches/${branchId}/regenerate-webhook-key`),
};

export const tasksAPI = {
  getAll: () => api.get('/tasks'),
  create: (data) => api.post('/tasks', data),
  updateStatus: (id, status) => api.put(`/tasks/${id}/status`, null, { params: { status } }),
};

export const examsAPI = {
  getTypes: () => api.get('/admin/exams'),
  createType: (data) => api.post('/admin/exams', data),
  deleteType: (id) => api.delete(`/admin/exams/${id}`),
  getBookings: () => api.get('/exam-bookings'),
  createBooking: (data) => api.post('/exam-bookings', data),
  updateBookingStatus: (id, status) => api.put(`/exam-bookings/${id}/status`, null, { params: { status } }),
};

export const quizAPI = {
  // Admin endpoints
  getAll: () => api.get('/quiz-exams'),
  getDetails: (id) => api.get(`/quiz-exams/${id}`),
  create: (data) => api.post('/quiz-exams', data),
  update: (id, data) => api.put(`/quiz-exams/${id}`, data),
  delete: (id) => api.delete(`/quiz-exams/${id}`),
  getAttempts: (examId) => api.get('/quiz-attempts', { params: examId ? { exam_id: examId } : {} }),
  // Public endpoints (no auth required for students)
  getPublicQuiz: (id) => axios.get(`${API_URL}/api/public/quiz/${id}`),
  startAttempt: (id, data) => axios.post(`${API_URL}/api/public/quiz/${id}/start`, data),
  submitAttempt: (attemptId, data) => axios.post(`${API_URL}/api/public/quiz/attempt/${attemptId}/submit`, data),
};

export default api;
