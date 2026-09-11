import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/token/refresh/', {
            refresh: refreshToken,
          });
          localStorage.setItem('access_token', data.access);
          if (data.refresh) {
            localStorage.setItem('refresh_token', data.refresh);
          }
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login/', data),
  logout: (data) => api.post('/auth/logout/', data),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (data) => api.patch('/auth/profile/', data),
  changePassword: (data) => api.post('/auth/change-password/', data),
  refreshToken: (data) => api.post('/auth/token/refresh/', data),
  forgotPassword: (data) => api.post('/auth/forgot-password/', data),
  resetPasswordFromToken: (data) => api.post('/auth/reset-password/', data),
};

export const usersAPI = {
  list: (params) => api.get('/auth/users/', { params }),
  get: (id) => api.get(`/auth/users/${id}/`),
  create: (data) => api.post('/auth/users/', data),
  update: (id, data) => api.patch(`/auth/users/${id}/`, data),
  delete: (id) => api.delete(`/auth/users/${id}/`),
  toggleActive: (id) => api.post(`/auth/users/${id}/toggle_active/`),
  resetPassword: (data) => api.post('/auth/users/reset_password/', data),
  getRecruiters: (params) => api.get('/auth/users/recruiters/', { params }),
};

export const candidatesAPI = {
  list: (params) => api.get('/candidates/', { params }),
  get: (id) => api.get(`/candidates/${id}/`),
  create: (data) => api.post('/candidates/', data),
  update: (id, data) => api.patch(`/candidates/${id}/`, data),
  delete: (id) => api.delete(`/candidates/${id}/`),
  fresh: (params) => api.get('/candidates/fresh/', { params }),
  freshSummary: (params) => api.get('/candidates/fresh-summary/', { params }),
  pipelineSummary: (params) => api.get('/candidates/pipeline-summary/', { params }),
  pipeline: (params) => api.get('/candidates/pipeline/', { params }),
  duplicates: (params) => api.get('/candidates/duplicates/', { params }),
  updateStatus: (id, data) => api.post(`/candidates/${id}/update_status/`, data),
  reassign: (id, data) => api.post(`/candidates/${id}/reassign/`, data),
  addNote: (id, data) => api.post(`/candidates/${id}/add_note/`, data),
  getNotes: (id) => api.get(`/candidates/${id}/notes/`),
  getActivity: (id) => api.get(`/candidates/${id}/activity/`),
  getAssignmentHistory: (id) => api.get(`/candidates/${id}/assignment_history/`),
  setFollowUp: (id, data) => api.post(`/candidates/${id}/set_follow_up/`, data),
  assignTrainer: (id, data) => api.post(`/candidates/${id}/assign_trainer/`, data),
  statusOptions: (params) => api.get('/candidates/status_options/', { params }),
  activityLog: (params) => api.get('/candidates/activity-log/', { params }),
  upload: (formData) => api.post('/candidates/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadPreview: (formData) => api.post('/candidates/upload/preview/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const batchesAPI = {
  list: (params) => api.get('/candidates/batches/', { params }),
  get: (id) => api.get(`/candidates/batches/${id}/`),
};

export const interviewsAPI = {
  list: (params) => api.get('/interviews/', { params }),
  get: (id) => api.get(`/interviews/${id}/`),
  create: (data) => api.post('/interviews/', data),
  update: (id, data) => api.patch(`/interviews/${id}/`, data),
  cancel: (id) => api.post(`/interviews/${id}/cancel/`),
  sendReminder: (id) => api.post(`/interviews/${id}/send_reminder/`),
  emailLogs: (params) => api.get('/interviews/emails/', { params }),
};

export const feedbackAPI = {
  list: (params) => api.get('/interviews/feedback/', { params }),
  get: (id) => api.get(`/interviews/feedback/${id}/`),
  create: (data) => api.post('/interviews/feedback/', data),
};

export const observationsAPI = {
  list: (params) => api.get('/interviews/observations/', { params }),
  get: (id) => api.get(`/interviews/observations/${id}/`),
  create: (data) => api.post('/interviews/observations/', data),
};

export const zoomRoomsAPI = {
  list: (params) => api.get('/interviews/zoom-rooms/', { params }),
  get: (id) => api.get(`/interviews/zoom-rooms/${id}/`),
  create: (data) => api.post('/interviews/zoom-rooms/', data),
  update: (id, data) => api.patch(`/interviews/zoom-rooms/${id}/`, data),
  delete: (id) => api.delete(`/interviews/zoom-rooms/${id}/`),
  toggleActive: (id) => api.post(`/interviews/zoom-rooms/${id}/toggle_active/`),
  testConnection: (id) => api.post(`/interviews/zoom-rooms/${id}/test_connection/`),
};

export const locationsAPI = {
  list: (params) => api.get('/interviews/locations/', { params }),
  get: (id) => api.get(`/interviews/locations/${id}/`),
  create: (data) => api.post('/interviews/locations/', data),
  update: (id, data) => api.patch(`/interviews/locations/${id}/`, data),
  delete: (id) => api.delete(`/interviews/locations/${id}/`),
  toggleActive: (id) => api.post(`/interviews/locations/${id}/toggle_active/`),
};

export const bookingsAPI = {
  list: (params) => api.get('/bookings/', { params }),
  get: (id) => api.get(`/bookings/${id}/`),
  create: (data) => api.post('/bookings/', data),
  confirm: (id) => api.post(`/bookings/${id}/confirm/`),
  cancel: (id, data) => api.post(`/bookings/${id}/cancel/`, data),
  markNoShow: (id) => api.post(`/bookings/${id}/mark_no_show/`),
};

export const interviewSlotsAPI = {
  list: (params) => api.get('/interviews/slots/', { params }),
  get: (id) => api.get(`/interviews/slots/${id}/`),
  create: (data) => api.post('/interviews/slots/', data),
  update: (id, data) => api.patch(`/interviews/slots/${id}/`, data),
  delete: (id) => api.delete(`/interviews/slots/${id}/`),
  cancel: (id) => api.post(`/interviews/slots/${id}/cancel/`),
  updateCapacity: (id, data) => api.post(`/interviews/slots/${id}/update_capacity/`, data),
  book: (id) => api.post(`/interviews/slots/${id}/book/`),
  unbook: (id) => api.post(`/interviews/slots/${id}/unbook/`),
};

export const callLogsAPI = {
  list: (params) => api.get('/interviews/call-logs/', { params }),
  create: (data) => api.post('/interviews/call-logs/', data),
};

export const dashboardAPI = {
  recruiter: (params) => api.get('/dashboard/recruiter/', { params }),
  admin: (params) => api.get('/dashboard/admin/', { params }),
};

export const reportsAPI = {
  recruiterWise: (params) => api.get('/reports/recruiter-wise/', { params }),
  contactedVsUncontacted: (params) => api.get('/reports/contacted-vs-uncontacted/', { params }),
  freshToPipeline: (params) => api.get('/reports/fresh-to-pipeline/', { params }),
  negativeBreakdown: (params) => api.get('/reports/negative-breakdown/', { params }),
  followUpPending: (params) => api.get('/reports/follow-up-pending/', { params }),
  pipelineStages: (params) => api.get('/reports/pipeline-stages/', { params }),
  uploadBatchSummary: (params) => api.get('/reports/upload-batch-summary/', { params }),
  duplicates: (params) => api.get('/reports/duplicates/', { params }),
  dailyTrends: (params) => api.get('/reports/daily-trends/', { params }),
  recruiterProductivity: (params) => api.get('/reports/recruiter-productivity/', { params }),
  exportCSV: (params) => api.get('/reports/export-csv/', { params, responseType: 'blob' }),
};

export const settingsAPI = {
  list: () => api.get('/candidates/settings/'),
  get: (key) => api.get(`/candidates/settings/${key}/`),
  update: (key, data) => api.patch(`/candidates/settings/${key}/`, data),
};

export default api;
