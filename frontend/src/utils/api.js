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
};

// Team API
export const teamAPI = {
  getAll: (filters) => api.get('/team', { params: filters }),
  getById: (id) => api.get(`/team/${id}`),
  create: (data) => api.post('/team', data),
  update: (id, data) => api.put(`/team/${id}`, data),
  delete: (id) => api.delete(`/team/${id}`),
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
  updateColor: (id, color) => api.put(`/notes/${id}/color`, { color }),
  addLink: (id, data) => api.post(`/notes/${id}/links`, data),
  removeLink: (id, linkId) => api.delete(`/notes/${id}/links/${linkId}`),
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
  syncAll: (date) => api.post('/client-metrics/sync-all', { date }),
};

// Facebook OAuth API
export const facebookOAuthAPI = {
  getAuthUrl: (clientId) => api.get(`/oauth/facebook/url?client_id=${clientId}`),
  getAdAccounts: (sessionId) => api.get(`/oauth/facebook/ad-accounts?session_id=${sessionId}`),
  linkAccounts: (data) => api.post('/oauth/facebook/link-accounts', data),
  unlinkAccount: (credentialId) => api.delete(`/oauth/facebook/unlink/${credentialId}`),
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
};

export default api;
