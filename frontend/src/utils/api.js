import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Clients API
export const clientsAPI = {
  getAll: (status) => api.get('/clients', { params: { status } }),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  searchNit: (nit) => api.get(`/clients/search-nit/${nit}`),
};

// Client Documents API
export const clientDocumentsAPI = {
  getAll: (clientId) => api.get(`/client-documents/${clientId}`),
  upload: (clientId, formData) => api.post(`/client-documents/${clientId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (clientId, docId, data) => api.put(`/client-documents/${clientId}/${docId}`, data),
  delete: (clientId, docId) => api.delete(`/client-documents/${clientId}/${docId}`),
};

// Projects API
export const projectsAPI = {
  getAll: (filters) => api.get('/projects', { params: filters }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  assignTeam: (id, data) => api.post(`/projects/${id}/team`, data),
  removeTeam: (id, memberId) => api.delete(`/projects/${id}/team/${memberId}`),
};

// Tasks API
export const tasksAPI = {
  getAll: (filters) => api.get('/tasks', { params: filters }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  bulkVisibility: (project_id, visible_to_client) => api.put('/tasks/bulk-visibility', { project_id, visible_to_client }),
};

// Auth API (multi-tenant)
export const authAPI = {
  login: (email, pin) => api.post('/auth/login', { email, pin }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  validateToken: () => api.get('/auth/validate'),
  selectOrg: (orgId) => api.post('/auth/select-org', { org_id: orgId }),
  register: (data) => api.post('/auth/register', data),
  bootstrap: (email, pin, name) => api.post('/auth/bootstrap', { email, pin, name }),
};

// Team API
export const teamAPI = {
  getAll: (filters) => api.get('/team', { params: filters }),
  getById: (id) => api.get(`/team/${id}`),
  create: (data) => api.post('/team', data),
  update: (id, data) => api.put(`/team/${id}`, data),
  delete: (id) => api.delete(`/team/${id}`),
  // Legacy auth (kept for backward compat, prefer authAPI)
  login: (email, pin) => api.post('/team/auth/login', { email, pin }),
  logout: () => api.post('/team/auth/logout'),
  getMe: () => api.get('/team/auth/me'),
  validateToken: () => api.get('/team/auth/validate'),
  updateProfile: (data) => api.put('/team/profile', data),
  updateOrgLogo: (logo_url) => api.put('/team/org-logo', { logo_url }),
  setPin: (memberId, pin) => api.post(`/team/${memberId}/set-pin`, { pin }),
  changePin: (currentPin, newPin) => api.post('/team/change-pin', { currentPin, newPin }),
  leaveOrg: () => api.post('/team/leave-org'),
};

// Add auth token to requests
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Invoices API
export const invoicesAPI = {
  getAll: (filters) => api.get('/invoices', { params: filters }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  send: (id) => api.post(`/invoices/${id}/send`),
  getHistory: (id) => api.get(`/invoices/${id}/history`),
  duplicate: (id) => api.post(`/invoices/${id}/duplicate`),
  getSiigoDetail: (id) => api.get(`/siigo/invoices/${id}/detail`),
  sendSiigoEmail: (id, email) => api.post(`/siigo/invoices/${id}/send-email`, { email }),
};

// Collections / Cartera API
export const collectionsAPI = {
  getSummary: () => api.get('/collections/summary'),
  getClientDetail: (clientId) => api.get(`/collections/client/${clientId}`),
  previewReminder: (data) => api.post('/collections/preview-reminder', data),
  sendReminder: (data) => api.post('/collections/send-reminder', data),
  getReminders: (filters) => api.get('/collections/reminders', { params: filters }),
  addNote: (data) => api.post('/collections/notes', data),
  getNotes: (clientId) => api.get(`/collections/notes/${clientId}`),
  markPaid: (data) => api.post('/collections/mark-paid', data),
  scheduleReminder: (data) => api.post('/collections/schedule-reminder', data),
  getScheduled: (filters) => api.get('/collections/scheduled', { params: filters }),
  cancelScheduled: (id) => api.delete(`/collections/scheduled/${id}`),
  processScheduled: () => api.post('/collections/process-scheduled'),
};

// Expenses API
export const expensesAPI = {
  getAll: (filters) => api.get('/expenses', { params: filters }),
  getById: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  getSummary: (filters) => api.get('/expenses/summary/by-category', { params: filters }),
};

// Dashboard API
export const dashboardAPI = {
  getStats: (dateRange) => api.get('/dashboard/stats', { params: dateRange }),
  getRecentActivity: (limit) => api.get('/dashboard/recent-activity', { params: { limit } }),
  getUpcomingTasks: () => api.get('/dashboard/upcoming-tasks'),
  getOverdueInvoices: () => api.get('/dashboard/overdue-invoices'),
  getRevenueTrend: (months) => api.get('/dashboard/revenue-trend', { params: { months } }),
};

// Board Columns API (Monday.com style)
export const boardColumnsAPI = {
  getByProject: (projectId) => api.get(`/board-columns/project/${projectId}`),
  getById: (id) => api.get(`/board-columns/${id}`),
  create: (data) => api.post('/board-columns', data),
  update: (id, data) => api.put(`/board-columns/${id}`, data),
  delete: (id) => api.delete(`/board-columns/${id}`),
  getValuesByTask: (taskId) => api.get(`/board-columns/values/task/${taskId}`),
  setValue: (data) => api.post('/board-columns/values', data),
};

// Task Dependencies API
export const taskDependenciesAPI = {
  getByTask: (taskId) => api.get(`/task-dependencies/task/${taskId}`),
  getDependents: (taskId) => api.get(`/task-dependencies/task/${taskId}/dependents`),
  getProjectChain: (projectId) => api.get(`/task-dependencies/project/${projectId}/chain`),
  create: (data) => api.post('/task-dependencies', data),
  update: (id, data) => api.put(`/task-dependencies/${id}`, data),
  delete: (id) => api.delete(`/task-dependencies/${id}`),
};

// Task Comments API
export const taskCommentsAPI = {
  getByTask: (taskId) => api.get(`/task-comments/task/${taskId}`),
  create: (data) => api.post('/task-comments', data),
  update: (id, data) => api.put(`/task-comments/${id}`, data),
  delete: (id) => api.delete(`/task-comments/${id}`),
};

// Task Files API
export const taskFilesAPI = {
  getByTask: (taskId) => api.get(`/task-files/task/${taskId}`),
  create: (data) => api.post('/task-files', data),
  delete: (id) => api.delete(`/task-files/${id}`),
};

// Notifications API
export const notificationsAPI = {
  getByUser: (userId, unreadOnly = false) => api.get(`/notifications/user/${userId}`, { params: { unread_only: unreadOnly } }),
  getUnreadCount: (userId) => api.get(`/notifications/user/${userId}/unread-count`),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: (userId) => api.put(`/notifications/user/${userId}/read-all`),
  delete: (id) => api.delete(`/notifications/${id}`),
  create: (data) => api.post('/notifications', data),
};

// Commissions API
export const comisionesAPI = {
  getAll: (params) => api.get('/commissions', { params }),
  getById: (id) => api.get(`/commissions/${id}`),
  create: (data) => api.post('/commissions', data),
  update: (id, data) => api.put(`/commissions/${id}`, data),
  delete: (id) => api.delete(`/commissions/${id}`),
  updateStatus: (id, status) => api.patch(`/commissions/${id}/status`, { status }),
  getMonthlyReport: (month, year) => api.get('/commissions/report/monthly', { params: { month, year } }),
};

// Subtasks API (ClickUp-style)
export const subtasksAPI = {
  getByTask: (taskId) => api.get(`/subtasks/task/${taskId}`),
  getById: (id) => api.get(`/subtasks/${id}`),
  create: (data) => api.post('/subtasks', data),
  update: (id, data) => api.put(`/subtasks/${id}`, data),
  toggle: (id) => api.put(`/subtasks/${id}/toggle`),
  reorder: (taskId, subtaskIds) => api.put(`/subtasks/reorder/${taskId}`, { subtaskIds }),
  delete: (id) => api.delete(`/subtasks/${id}`),
  getProgress: (taskId) => api.get(`/subtasks/task/${taskId}/progress`),
};

// Tags API (ClickUp-style)
export const tagsAPI = {
  getAll: () => api.get('/tags'),
  getById: (id) => api.get(`/tags/${id}`),
  create: (data) => api.post('/tags', data),
  update: (id, data) => api.put(`/tags/${id}`, data),
  delete: (id) => api.delete(`/tags/${id}`),
  getByTask: (taskId) => api.get(`/tags/task/${taskId}`),
  addToTask: (taskId, tagId) => api.post(`/tags/task/${taskId}/tag/${tagId}`),
  removeFromTask: (taskId, tagId) => api.delete(`/tags/task/${taskId}/tag/${tagId}`),
  setTaskTags: (taskId, tagIds) => api.put(`/tags/task/${taskId}`, { tagIds }),
};

// Global Search API
export const searchAPI = {
  search: (query, limit) => api.get('/search', { params: { q: query, limit } }),
  quickSearch: (query, limit) => api.get('/search/quick', { params: { q: query, limit } }),
};

// Automations API
export const automationsAPI = {
  getAll: () => api.get('/automations'),
  getById: (id) => api.get(`/automations/${id}`),
  getByProject: (projectId) => api.get(`/automations/project/${projectId}`),
  create: (data) => api.post('/automations', data),
  update: (id, data) => api.put(`/automations/${id}`, data),
  toggle: (id) => api.put(`/automations/${id}/toggle`),
  delete: (id) => api.delete(`/automations/${id}`),
};

// Reports API
export const reportsAPI = {
  getProductivity: (params) => api.get('/reports/productivity', { params }),
  getFinancial: (params) => api.get('/reports/financial', { params }),
  getProjects: (params) => api.get('/reports/projects', { params }),
  getTeam: (params) => api.get('/reports/team', { params }),
};

// Notes API (Bloc de notas)
export const notesAPI = {
  getAll: (filters) => api.get('/notes', { params: filters }),
  getById: (id) => api.get(`/notes/${id}`),
  getByClient: (clientId) => api.get(`/notes/client/${clientId}`),
  getByProject: (projectId) => api.get(`/notes/project/${projectId}`),
  getByTeamMember: (memberId) => api.get(`/notes/team/${memberId}`),
  search: (query, limit) => api.get('/notes/search/query', { params: { q: query, limit } }),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
  togglePin: (id) => api.put(`/notes/${id}/pin`),
  uploadImage: (formData) => api.post('/notes/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateColor: (id, color) => api.put(`/notes/${id}/color`, { color }),
  addLink: (id, data) => api.post(`/notes/${id}/links`, data),
  removeLink: (id, linkId) => api.delete(`/notes/${id}/links/${linkId}`),
  togglePortalVisibility: (id, linkId) => api.put(`/notes/${id}/links/${linkId}/portal`),
};

// Note Categories API
export const noteCategoriesAPI = {
  getAll: () => api.get('/note-categories'),
  getById: (id) => api.get(`/note-categories/${id}`),
  create: (data) => api.post('/note-categories', data),
  update: (id, data) => api.put(`/note-categories/${id}`, data),
  delete: (id) => api.delete(`/note-categories/${id}`),
};

// Note Folders API
export const noteFoldersAPI = {
  getAll: () => api.get('/note-folders'),
  getFlat: () => api.get('/note-folders/flat'),
  getById: (id) => api.get(`/note-folders/${id}`),
  create: (data) => api.post('/note-folders', data),
  update: (id, data) => api.put(`/note-folders/${id}`, data),
  delete: (id) => api.delete(`/note-folders/${id}`),
  reorder: (folders) => api.put('/note-folders/reorder', { folders }),
};

// Platform Credentials API (Facebook Ads & Shopify)
export const platformCredentialsAPI = {
  getByClient: (clientId) => api.get(`/platform-credentials/client/${clientId}`),
  // Facebook
  connectFacebook: (data) => api.post('/platform-credentials/facebook', data),
  testFacebook: (id) => api.post(`/platform-credentials/facebook/${id}/test`),
  disconnectFacebook: (id) => api.delete(`/platform-credentials/facebook/${id}`),
  // Shopify
  connectShopify: (data) => api.post('/platform-credentials/shopify', data),
  testShopify: (id) => api.post(`/platform-credentials/shopify/${id}/test`),
  disconnectShopify: (id) => api.delete(`/platform-credentials/shopify/${id}`),
};

// Client Metrics API (Facebook Ads & Shopify metrics)
export const clientMetricsAPI = {
  getMetrics: (clientId, startDate, endDate) =>
    api.get(`/client-metrics/${clientId}`, { params: { start_date: startDate, end_date: endDate } }),
  getDailyMetrics: (clientId, startDate, endDate) =>
    api.get(`/client-metrics/${clientId}/daily`, { params: { start_date: startDate, end_date: endDate } }),
  getAggregate: (startDate, endDate) =>
    api.get('/client-metrics/aggregate/all', { params: { start_date: startDate, end_date: endDate } }),
  getSummary: () => api.get('/client-metrics/summary/all'),
  syncClient: (clientId, startDate, endDate) =>
    api.post(`/client-metrics/sync/${clientId}`, { start_date: startDate, end_date: endDate }),
  syncAll: () => api.post('/client-metrics/sync-all', {}),
  getSyncStatus: (startDate, endDate) =>
    api.get('/client-metrics/sync-status', { params: { start_date: startDate, end_date: endDate } }),
  getAds: (clientId, startDate, endDate) =>
    api.get(`/client-metrics/${clientId}/ads`, { params: { start_date: startDate, end_date: endDate } }),
  getTopProducts: (clientId, startDate, endDate) =>
    api.get(`/client-metrics/${clientId}/top-products`, { params: { start_date: startDate, end_date: endDate } }),
};

// Facebook OAuth API
export const facebookOAuthAPI = {
  getAuthUrl: (clientId) => api.get(`/oauth/facebook/url?client_id=${clientId}`),
  getAdAccounts: (sessionId) => api.get(`/oauth/facebook/ad-accounts?session_id=${sessionId}`),
  linkAccounts: (data) => api.post('/oauth/facebook/link-accounts', data),
  unlinkAccount: (credentialId) => api.delete(`/oauth/facebook/unlink/${credentialId}`),
};

// Shopify OAuth API
export const shopifyOAuthAPI = {
  getAuthUrl: (clientId, storeUrl) =>
    api.get(`/oauth/shopify/url?client_id=${clientId}&store_url=${encodeURIComponent(storeUrl)}`),
  pollCallbackStatus: (state) =>
    api.get(`/oauth/shopify/callback-status?state=${state}`),
  getStoreInfo: (sessionId) =>
    api.get(`/oauth/shopify/store-info?session_id=${sessionId}`),
  linkStore: (data) => api.post('/oauth/shopify/link-store', data),
  unlinkStore: (credentialId) => api.delete(`/oauth/shopify/unlink/${credentialId}`),
  saveCredentials: (data) => api.post('/oauth/shopify/save-credentials', data),
};

// PDF Analysis API (RUT extraction with Claude AI)
export const pdfAnalysisAPI = {
  analyzeRut: (formData) => api.post('/pdf/analyze-rut', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// SOPs API (Standard Operating Procedures)
export const sopsAPI = {
  // Categories
  getCategories: () => api.get('/sops/categories'),
  createCategory: (data) => api.post('/sops/categories', data),
  updateCategory: (id, data) => api.put(`/sops/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/sops/categories/${id}`),
  // SOPs
  getAll: (params) => api.get('/sops', { params }),
  getById: (id) => api.get(`/sops/${id}`),
  getBySlug: (slug) => api.get(`/sops/${slug}`),
  create: (data) => api.post('/sops', data),
  update: (id, data) => api.put(`/sops/${id}`, data),
  togglePin: (id) => api.put(`/sops/${id}/pin`),
  delete: (id) => api.delete(`/sops/${id}`),
  getRevisions: (id) => api.get(`/sops/${id}/revisions`),
};

// Project Templates API
export const projectTemplatesAPI = {
  getAll: () => api.get('/project-templates'),
  getById: (id) => api.get(`/project-templates/${id}`),
  create: (data) => api.post('/project-templates', data),
  update: (id, data) => api.put(`/project-templates/${id}`, data),
  delete: (id) => api.delete(`/project-templates/${id}`),
  // Template tasks
  addTask: (templateId, data) => api.post(`/project-templates/${templateId}/tasks`, data),
  updateTask: (templateId, taskId, data) => api.put(`/project-templates/${templateId}/tasks/${taskId}`, data),
  deleteTask: (templateId, taskId) => api.delete(`/project-templates/${templateId}/tasks/${taskId}`),
  reorderTasks: (templateId, taskIds) => api.put(`/project-templates/${templateId}/tasks/reorder`, { taskIds }),
};

// Portal Admin API (manage client portal access)
export const portalAdminAPI = {
  getSettings: async (clientId) => {
    const response = await api.get(`/portal-admin/clients/${clientId}/settings`);
    return response.data;
  },
  updateSettings: async (clientId, settings) => {
    const response = await api.put(`/portal-admin/clients/${clientId}/settings`, settings);
    return response.data;
  },
  generateInvite: async (clientId) => {
    const response = await api.post(`/portal-admin/clients/${clientId}/invite`);
    return response.data;
  },
  getAccess: async (clientId) => {
    const response = await api.get(`/portal-admin/clients/${clientId}/access`);
    return response.data;
  },
  revokeAccess: async (clientId, tokenId) => {
    const response = await api.delete(`/portal-admin/clients/${clientId}/access/${tokenId}`);
    return response.data;
  },
  // Priorities
  getPriorities: (clientId) => api.get(`/portal-admin/priorities/${clientId}`),
  savePriorities: (clientId, items) => api.put(`/portal-admin/priorities/${clientId}`, { items }),
  // Commercial dates (org-level)
  getAllCommercialDates: () => api.get('/portal-admin/commercial-dates'),
  createCommercialDate: (data) => api.post('/portal-admin/commercial-dates', data),
  updateCommercialDateGroup: (data) => api.put('/portal-admin/commercial-dates/group', data),
  deleteCommercialDateGroup: (title, date) => api.delete(`/portal-admin/commercial-dates/group?title=${encodeURIComponent(title)}&date=${date}`),
};

// Note Share API
export const noteShareAPI = {
  getEdits: (noteId) => api.get(`/note-share/${noteId}/edits`),
  reviewEdit: (noteId, editId, action) => api.put(`/note-share/${noteId}/edits/${editId}`, { action }),
};

// Dashboard Share API
export const dashboardShareAPI = {
  createShare: (clientId, data) => api.post(`/dashboard-share/clients/${clientId}/share`, data),
  getShares: (clientId) => api.get(`/dashboard-share/clients/${clientId}/shares`),
  revokeShare: (clientId, tokenId) => api.delete(`/dashboard-share/clients/${clientId}/share/${tokenId}`),
};

// CRM API
export const crmAPI = {
  // Stages
  getStages: () => api.get('/crm/stages'),
  // Deals
  getDeals: (params) => api.get('/crm/deals', { params }),
  getDeal: (id) => api.get(`/crm/deals/${id}`),
  createDeal: (data) => api.post('/crm/deals', data),
  updateDeal: (id, data) => api.put(`/crm/deals/${id}`, data),
  deleteDeal: (id) => api.delete(`/crm/deals/${id}`),
  moveDeal: (id, stage_id) => api.patch(`/crm/deals/${id}/stage`, { stage_id }),
  // Activities
  getActivities: (dealId) => api.get(`/crm/deals/${dealId}/activities`),
  createActivity: (dealId, data) => api.post(`/crm/deals/${dealId}/activities`, data),
  deleteActivity: (id) => api.delete(`/crm/activities/${id}`),
  // Transcript
  processTranscript: (dealId, text) => api.post(`/crm/deals/${dealId}/transcript`, { text }),
  // Convert
  convertToClient: (dealId) => api.post(`/crm/deals/${dealId}/convert`),
  // Proposals
  getTemplates: () => api.get('/crm/proposals/templates'),
  generateProposal: (data) => api.post('/crm/proposals/generate', data, { timeout: 150000 }),
  generateCustomProposal: (data) => api.post('/crm/proposals/generate-custom', data, { timeout: 150000 }),
  deployProposal: (data) => api.post('/crm/proposals/deploy', data, { timeout: 60000 }),
};

// Forms API (Formularios)
export const formsAPI = {
  getAll: (filters) => api.get('/forms', { params: filters }),
  getById: (id) => api.get(`/forms/${id}`),
  create: (data) => api.post('/forms', data),
  update: (id, data) => api.put(`/forms/${id}`, data),
  delete: (id) => api.delete(`/forms/${id}`),
  duplicate: (id) => api.post(`/forms/${id}/duplicate`),
  assign: (id, data) => api.post(`/forms/${id}/assign`, data),
  getAssignments: (id) => api.get(`/forms/${id}/assignments`),
  removeAssignment: (assignmentId) => api.delete(`/forms/assignments/${assignmentId}`),
  getResponse: (assignmentId) => api.get(`/forms/assignments/${assignmentId}/response`),
  getByClient: (clientId) => api.get(`/forms/client/${clientId}`),
  generateShareLink: (id) => api.post(`/forms/${id}/share`),
  revokeShareLink: (id) => api.delete(`/forms/${id}/share`),
  getPublicResponses: (id) => api.get(`/forms/${id}/public-responses`),
  getPublicResponse: (responseId) => api.get(`/forms/public-responses/${responseId}`),
};

// Ad Creative Tagging API
export const adTagsAPI = {
  getCategories: () => api.get('/ad-tags/categories'),
  createCategory: (data) => api.post('/ad-tags/categories', data),
  updateCategory: (id, data) => api.put(`/ad-tags/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/ad-tags/categories/${id}`),
  createValue: (categoryId, data) => api.post(`/ad-tags/categories/${categoryId}/values`, data),
  updateValue: (id, data) => api.put(`/ad-tags/values/${id}`, data),
  deleteValue: (id) => api.delete(`/ad-tags/values/${id}`),
  getAssignments: (clientId) => api.get(`/ad-tags/assignments/${clientId}`),
  setAdTags: (adId, data) => api.put(`/ad-tags/assignments/${adId}`, data),
  bulkAssign: (data) => api.post('/ad-tags/assignments/bulk', data),
};

export const agentsAPI = {
  list: () => api.get('/agents'),
  getBySlug: (slug) => api.get(`/agents/${slug}`),
  query: (slug, data) => api.post(`/agents/${slug}/query`, data),
  stream: (slug, data) => api.post(`/agents/${slug}/stream`, data, { responseType: 'text' }),
};

export const chatAPI = {
  getConversations: () => api.get('/chat/conversations'),
  createConversation: (data) => api.post('/chat/conversations', data),
  getConversation: (id) => api.get(`/chat/conversations/${id}`),
  updateConversation: (id, data) => api.put(`/chat/conversations/${id}`, data),
  getMessages: (id, params) => api.get(`/chat/conversations/${id}/messages`, { params }),
  sendMessage: (id, data) => api.post(`/chat/conversations/${id}/messages`, data),
  markRead: (id) => api.put(`/chat/conversations/${id}/read`),
  uploadImage: (id, formData) => api.post(`/chat/conversations/${id}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getUnreadCount: () => api.get('/chat/unread-count'),
  searchEntities: (q, type) => api.get('/chat/search/entities', { params: { q, type } }),
  getEntityPreview: (type, id) => api.get(`/chat/entity-preview/${type}/${id}`),
};

export default api;
