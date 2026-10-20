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

// 401 handling — verify-before-logout (same defence as the main api.js).
// A single buggy endpoint or transient 401 used to log the client out;
// now we ask /auth/validate once before kicking them out.
const PORTAL_AUTH_ENDPOINTS = ['/auth/validate', '/auth/me', '/auth/login', '/auth/logout'];
let pendingPortalValidation = null;

const isPortalAuthEndpoint = (url = '') =>
  PORTAL_AUTH_ENDPOINTS.some(suffix => url.endsWith(suffix));

const performPortalLogout = () => {
  localStorage.removeItem('portalToken');
  window.location.href = '/portal/login';
};

portalApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status !== 401) return Promise.reject(error);

    const url = error?.config?.url || '';
    console.warn('[portalApi] 401 from', url);

    if (isPortalAuthEndpoint(url)) {
      performPortalLogout();
      return Promise.reject(error);
    }

    if (!pendingPortalValidation) {
      pendingPortalValidation = portalApi.get('/auth/validate')
        .then(() => ({ stillValid: true }))
        .catch((vErr) => ({
          stillValid: !(vErr?.response?.status === 401 || vErr?.response?.status === 403),
        }))
        .finally(() => {
          setTimeout(() => { pendingPortalValidation = null; }, 1500);
        });
    }

    try {
      const { stillValid } = await pendingPortalValidation;
      if (!stillValid) performPortalLogout();
    } catch { /* never throws */ }

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
  respondCommercialDate: async (id, data) => {
    const response = await portalApi.put(`/dashboard/commercial-dates/${id}`, data);
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
// PAYMENT PROOFS API (portal)
// ============================================
export const portalPaymentProofsAPI = {
  list: async () => {
    const response = await portalApi.get('/payment-proofs');
    return response.data;
  },
  upload: async (invoiceId, file, notes) => {
    const formData = new FormData();
    formData.append('file', file);
    if (notes) formData.append('notes', notes);
    const response = await portalApi.post(`/payment-proofs/${invoiceId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  delete: async (id) => {
    const response = await portalApi.delete(`/payment-proofs/${id}`);
    return response.data;
  },
};

// ============================================
// REPORTS API (portal)
// ============================================
export const portalReportsAPI = {
  list: async () => {
    const response = await portalApi.get('/reports');
    return response.data;
  },
};

export const portalEmailMarketingAPI = {
  list: async (params = {}) => {
    const response = await portalApi.get('/email-marketing', { params });
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

  getInsight: async () => {
    const response = await portalApi.get('/metrics/insight');
    return response.data;
  },

  getAds: async (params = {}) => {
    const response = await portalApi.get('/metrics/ads', { params });
    return response.data;
  },

  getGoogleCampaigns: async (params = {}) => {
    const response = await portalApi.get('/metrics/google-campaigns', { params });
    return response.data;
  },

  getTiktokCampaigns: async (params = {}) => {
    const response = await portalApi.get('/metrics/tiktok-campaigns', { params });
    return response.data;
  },

  getAdPreview: async (adId, format = 'MOBILE_FEED_STANDARD') => {
    const response = await portalApi.get(`/metrics/ads/${adId}/preview`, { params: { format } });
    return response.data;
  },

  getTopProducts: async (params = {}) => {
    const response = await portalApi.get('/metrics/top-products', { params });
    return response.data;
  },

  getDemographics: async (params = {}) => {
    const response = await portalApi.get('/metrics/demographics', { params });
    return response.data;
  },

  getChannels: async (params = {}) => {
    const response = await portalApi.get('/metrics/channels', { params });
    return response.data;
  },

  getCategories: async (params = {}) => {
    const response = await portalApi.get('/metrics/categories', { params });
    return response.data;
  },
};

// Ventas por WhatsApp registradas por el cliente
export const portalWhatsappSalesAPI = {
  list: async (params = {}) => (await portalApi.get('/whatsapp-sales', { params })).data,
  save: async (data) => (await portalApi.post('/whatsapp-sales', data)).data,
  remove: async (date) => (await portalApi.delete(`/whatsapp-sales/${date}`)).data,
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

// Forms API
export const portalFormsAPI = {
  getAll: async () => {
    const response = await portalApi.get('/forms');
    return response.data;
  },
  getById: async (assignmentId) => {
    const response = await portalApi.get(`/forms/${assignmentId}`);
    return response.data;
  },
  saveDraft: async (assignmentId, data) => {
    const response = await portalApi.put(`/forms/${assignmentId}`, { data });
    return response.data;
  },
  submit: async (assignmentId, data) => {
    const response = await portalApi.post(`/forms/${assignmentId}/submit`, { data });
    return response.data;
  },
};

// Calls API
export const portalCallsAPI = {
  getAll: async () => {
    const response = await portalApi.get('/calls');
    return response.data;
  },
  getById: async (id) => {
    const response = await portalApi.get(`/calls/${id}`);
    return response.data;
  },
};

export const portalNotesAPI = {
  getNote: async (noteId) => {
    const response = await portalApi.get(`/notes/${noteId}`);
    return response.data;
  },
  addComment: async (noteId, data) => {
    const response = await portalApi.post(`/notes/${noteId}/comments`, data);
    return response.data;
  },
  updateComment: async (noteId, commentId, content) => {
    const response = await portalApi.put(`/notes/${noteId}/comments/${commentId}`, { content });
    return response.data;
  },
  deleteComment: async (noteId, commentId) => {
    const response = await portalApi.delete(`/notes/${noteId}/comments/${commentId}`);
    return response.data;
  },
};

export const portalReferenceAdsAPI = {
  list: async () => {
    const response = await portalApi.get('/reference-ads');
    return response.data;
  },
};

// UGC (User Generated Content) - Portal view for clients
export const portalUGCAPI = {
  getCreators: async () => {
    const response = await portalApi.get('/ugc/creators');
    return response.data;
  },
  getCreator: async (id) => {
    const response = await portalApi.get(`/ugc/creators/${id}`);
    return response.data;
  },
  getAssignments: async (filters) => {
    const response = await portalApi.get('/ugc/assignments', { params: filters });
    return response.data;
  },
  getAssignment: async (id) => {
    const response = await portalApi.get(`/ugc/assignments/${id}`);
    return response.data;
  },
  // Shipping endpoints for project creators
  getShippingInfo: async (projectCreatorId) => {
    const response = await portalApi.get(`/ugc/project-creators/${projectCreatorId}/shipping`);
    return response.data;
  },
  updateShipping: async (projectCreatorId, data) => {
    const response = await portalApi.put(`/ugc/project-creators/${projectCreatorId}/shipping`, data);
    return response.data;
  },
};

// Document Signing (NDA, Contracts) - Portal view for clients
export const portalDocumentsAPI = {
  getPending: async () => {
    const response = await portalApi.get('/documents/pending');
    return response.data;
  },
  getSigned: async () => {
    const response = await portalApi.get('/documents/signed');
    return response.data;
  },
  getDocument: async (signatureId) => {
    const response = await portalApi.get(`/documents/${signatureId}`);
    return response.data;
  },
  sign: async (signatureId, data) => {
    const response = await portalApi.post(`/documents/${signatureId}/sign`, data);
    return response.data;
  },
  checkRequired: async () => {
    const response = await portalApi.get('/documents/check/required');
    return response.data;
  },
};

// ============================================
// STRUCTURED BRIEFS API (Portal)
// ============================================
export const portalStructuredBriefsAPI = {
  list: async () => {
    const response = await portalApi.get('/structured-briefs');
    return response.data;
  },
  getById: async (id) => {
    const response = await portalApi.get(`/structured-briefs/${id}`);
    return response.data;
  },
};

// ============================================
// FINANCIALS API (Portal) — dashboard financiero del cliente
// Mismo contrato que growthAPI.getFinancials/costos/productos, pero sin clientId
// (el backend usa el cliente autenticado). Devuelve response.data como el resto del portal.
// ============================================
export const portalFinancialsAPI = {
  get: async (period, { light = false } = {}) => {
    const response = await portalApi.get('/financials', { params: { period, ...(light ? { light: 1 } : {}) } });
    return response.data;
  },
  updateSettings: async (data) => {
    const response = await portalApi.put('/financials/settings', data);
    return response.data;
  },

  getFixedCosts: async () => (await portalApi.get('/financials/fixed-costs')).data,
  createFixedCost: async (data) => (await portalApi.post('/financials/fixed-costs', data)).data,
  updateFixedCost: async (id, data) => (await portalApi.put(`/financials/fixed-costs/${id}`, data)).data,
  deleteFixedCost: async (id) => (await portalApi.delete(`/financials/fixed-costs/${id}`)).data,

  getVariableCosts: async () => (await portalApi.get('/financials/variable-costs')).data,
  createVariableCost: async (data) => (await portalApi.post('/financials/variable-costs', data)).data,
  updateVariableCost: async (id, data) => (await portalApi.put(`/financials/variable-costs/${id}`, data)).data,
  deleteVariableCost: async (id) => (await portalApi.delete(`/financials/variable-costs/${id}`)).data,

  updateProductCost: async (productId, cost) => (await portalApi.put(`/financials/products/${productId}/cost`, { cost })).data,
  updateVariantCost: async (variantId, cost) => (await portalApi.put(`/financials/products/variant/${encodeURIComponent(variantId)}/cost`, { cost })).data,
  resetProductCost: async (productId) => (await portalApi.delete(`/financials/products/${productId}/cost`)).data,
  syncProducts: async () => (await portalApi.post('/financials/products/sync')).data,

  getObjective: async (period) => (await portalApi.get('/financials/objective', { params: { period } })).data,
  saveObjective: async (data) => (await portalApi.post('/financials/objective', data)).data,
  // Escenarios (los privados solo los ve la marca)
  scenarios: async (params) => (await portalApi.get('/financials/scenarios', { params })).data,
  createScenario: async (body) => (await portalApi.post('/financials/scenarios', body)).data,
  updateScenario: async (id, body) => (await portalApi.put(`/financials/scenarios/${id}`, body)).data,
  deleteScenario: async (id) => (await portalApi.delete(`/financials/scenarios/${id}`)).data,
  evaluateScenario: async (body) => (await portalApi.post('/financials/scenarios/evaluate', body)).data,
  compareScenarios: async (ids, period) => (await portalApi.get('/financials/scenarios/compare', { params: { ids: (ids || []).join(','), period } })).data,
  // Cuándo compran / nuevos vs recurrentes
  patterns: async (days = 90) => (await portalApi.get('/financials/patterns', { params: { days } })).data,
  customerMix: async (start, end) => (await portalApi.get('/financials/customer-mix', { params: { start, end } })).data,
  backfillOrders: async (days = 180) => (await portalApi.post('/financials/orders/backfill', { days })).data,
  // Excel
  exportExcel: (period) => portalApi.get('/financials/export.xlsx', { params: { period }, responseType: 'blob' }),
};

export default portalApi;
