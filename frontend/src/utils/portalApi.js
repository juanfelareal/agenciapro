import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create portal API instance
const portalApi = axios.create({
  baseURL: `${API_URL}/portal`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portalToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('portalToken');
      window.location.href = '/portal/login';
    }
    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================
export const portalAuthAPI = {
  login: async (code) => {
    const response = await portalApi.post('/auth/login', { code });
    return response.data;
  },

  logout: async () => {
    const response = await portalApi.post('/auth/logout');
    return response.data;
  },

  validate: async () => {
    const response = await portalApi.get('/auth/validate');
    return response.data;
  },

  getMe: async () => {
    const response = await portalApi.get('/auth/me');
    return response.data;
  },
};

// ============================================
// DASHBOARD API
// ============================================
export const portalDashboardAPI = {
  get: async () => {
    const response = await portalApi.get('/dashboard');
    return response.data;
  },
};

// ============================================
// PROJECTS API
// ============================================
export const portalProjectsAPI = {
  getAll: async () => {
    const response = await portalApi.get('/projects');
    return response.data;
  },

  getById: async (id) => {
    const response = await portalApi.get(`/projects/${id}`);
    return response.data;
  },
};

// ============================================
// TASKS API
// ============================================
export const portalTasksAPI = {
  getAll: async (params = {}) => {
    const response = await portalApi.get('/tasks', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await portalApi.get(`/tasks/${id}`);
    return response.data;
  },

  submitApproval: async (id, data) => {
    const response = await portalApi.put(`/tasks/${id}/approval`, data);
    return response.data;
  },

  getComments: async (id) => {
    const response = await portalApi.get(`/tasks/${id}/comments`);
    return response.data;
  },

  addComment: async (id, comment) => {
    const response = await portalApi.post(`/tasks/${id}/comments`, { comment });
    return response.data;
  },

  create: async (data) => {
    const response = await portalApi.post('/tasks', data);
    return response.data;
  },
};

// ============================================
// INVOICES API
// ============================================
export const portalInvoicesAPI = {
  getAll: async (params = {}) => {
    const response = await portalApi.get('/invoices', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await portalApi.get(`/invoices/${id}`);
    return response.data;
  },
};

// ============================================
// METRICS API
// ============================================
export const portalMetricsAPI = {
  getSummary: async (params = {}) => {
    const response = await portalApi.get('/metrics', { params });
    return response.data;
  },

  getDaily: async (params = {}) => {
    const response = await portalApi.get('/metrics/daily', { params });
    return response.data;
  },
};

// ============================================
// NOTIFICATIONS API
// ============================================
export const portalNotificationsAPI = {
  getAll: async (params = {}) => {
    const response = await portalApi.get('/notifications', { params });
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await portalApi.put(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await portalApi.put('/notifications/read-all');
    return response.data;
  },
};

export default portalApi;
