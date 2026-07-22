import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ------------------------------------------------------------
// 401 handling — verify-before-logout
// ------------------------------------------------------------
// Old behaviour was "any 401 anywhere → log out", which was way too
// aggressive: a single buggy endpoint or transient backend hiccup would
// kick every user back to the login screen. Now, when we see a 401 we:
//   1. Skip if we're on the login page or in the portal (different auth).
//   2. If the failing request was itself an auth endpoint, the session
//      really is gone — logout immediately (no point verifying).
//   3. Otherwise, hit /auth/validate ONCE (single-flight across all
//      concurrent failures) to confirm the token is dead before logging
//      out. If validate succeeds → keep the user; only the offending
//      endpoint had a problem.
const AUTH_ENDPOINTS = ['/auth/validate', '/auth/me', '/auth/login', '/auth/logout'];
let pendingValidation = null; // single-flight guard

const isAuthEndpoint = (url = '') => AUTH_ENDPOINTS.some(suffix => url.endsWith(suffix));

const performLogout = () => {
  const path = window.location.pathname;
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  localStorage.removeItem('authUser');
  localStorage.removeItem('currentOrg');
  delete api.defaults.headers.common['Authorization'];
  const next = encodeURIComponent(path + window.location.search);
  window.location.replace(`/login?session=expired&next=${next}`);
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    if (status !== 401) return Promise.reject(error);

    const path = window.location.pathname;
    const onLogin = path === '/login' || path === '/';
    const onPortal = path.startsWith('/portal');
    if (onLogin || onPortal) return Promise.reject(error);

    const url = error?.config?.url || '';
    console.warn('[api] 401 from', url);

    // The auth endpoints ARE the source of truth — if /auth/me or
    // /auth/validate themselves 401, the token really is dead.
    if (isAuthEndpoint(url)) {
      performLogout();
      return Promise.reject(error);
    }

    // Otherwise, verify before bouncing. Single-flight so a burst of
    // concurrent 401s only causes one validation call.
    if (!pendingValidation) {
      pendingValidation = api.get('/auth/validate')
        .then(() => ({ stillValid: true }))
        .catch((vErr) => ({
          stillValid: !(vErr?.response?.status === 401 || vErr?.response?.status === 403),
        }))
        .finally(() => {
          // Allow another verification after this batch settles.
          setTimeout(() => { pendingValidation = null; }, 1500);
        });
    }

    try {
      const { stillValid } = await pendingValidation;
      if (!stillValid) {
        performLogout();
      }
      // If still valid, swallow the side-effect of this 401 and let the
      // caller handle the error normally (no forced logout).
    } catch { /* never throws — pendingValidation resolves */ }

    return Promise.reject(error);
  }
);

// Clients API
export const clientsAPI = {
  getAll: (status) => api.get('/clients', { params: { status } }),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  searchNit: (nit) => api.get(`/clients/search-nit/${nit}`),
  syncToSiigo: (id) => api.post(`/siigo/customers/sync/${id}`),
};

export const clientReportsAPI = {
  list: (clientId) => api.get(`/client-reports/${clientId}`),
  upload: (clientId, formData) =>
    api.post(`/client-reports/${clientId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (clientId, reportId) => api.delete(`/client-reports/${clientId}/${reportId}`),
};

export const emailMarketingAPI = {
  list: (clientId, params) => api.get(`/email-marketing/${clientId}`, { params }),
  create: (clientId, data) => api.post(`/email-marketing/${clientId}`, data),
  update: (clientId, campaignId, data) => api.put(`/email-marketing/${clientId}/${campaignId}`, data),
  delete: (clientId, campaignId) => api.delete(`/email-marketing/${clientId}/${campaignId}`),
};

// Client Documents API
export const clientDocumentsAPI = {
  getAll: (clientId) => api.get(`/client-documents/${clientId}`),
  upload: (clientId, formData) => api.post(`/client-documents/${clientId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (clientId, docId, data) => api.put(`/client-documents/${clientId}/${docId}`, data),
  delete: (clientId, docId) => api.delete(`/client-documents/${clientId}/${docId}`),
};

// Projects API
export const projectStagesAPI = {
  getAll: () => api.get('/project-stages'),
  create: (data) => api.post('/project-stages', data),
  update: (id, data) => api.put(`/project-stages/${id}`, data),
  delete: (id) => api.delete(`/project-stages/${id}`),
};

export const projectsAPI = {
  getAll: (filters) => api.get('/projects', { params: filters }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id, options = {}) => api.delete(`/projects/${id}`, {
    params: options.moveTasksTo ? { move_tasks_to: options.moveTasksTo } : {},
  }),
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
  getMonthlySalesComparison: (year) => api.get('/dashboard/monthly-sales-comparison', { params: { year } }),
};

export const salesGoalsAPI = {
  list: (year) => api.get('/sales-goals', { params: { year } }),
  upsert: (year, month, goal_amount) => api.put(`/sales-goals/${year}/${month}`, { goal_amount }),
  bulkUpsert: (year, goals) => api.post('/sales-goals/bulk', { year, goals }),
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
  upload: (taskId, file, uploadedBy) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('task_id', taskId);
    if (uploadedBy != null) fd.append('uploaded_by', uploadedBy);
    return api.post('/task-files/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // Agrega un link/embed (Drive, Loom, Figma, etc.) como entregable.
  // Reusa la tabla task_files: file_path = URL absoluta, file_type = 'embed'.
  addLink: (taskId, url, uploadedBy, { title, description } = {}) => api.post('/task-files', {
    task_id: taskId,
    file_name: title || url,
    file_path: url,
    file_type: 'embed',
    file_size: 0,
    description: description || null,
    uploaded_by: uploadedBy ?? null,
  }),
  update: (id, { title, description } = {}) => api.patch(`/task-files/${id}`, {
    file_name: title,
    description,
  }),
  delete: (id) => api.delete(`/task-files/${id}`),
};

// Notifications API
// Shared icon/color/category metadata for the new notification taxonomy.
// Imported by NotificationBell + Inbox + anywhere else that renders a notification.
export const NOTIFICATION_TYPE_META = {
  // Client actions (highlight visually — what the user actually cares about)
  client_approved:           { category: 'client_action', icon: '✅', color: 'bg-emerald-100 text-emerald-700', label: 'Cliente aprobó' },
  client_rejected:           { category: 'client_action', icon: '❌', color: 'bg-red-100 text-red-700',         label: 'Cliente rechazó' },
  client_changes_requested:  { category: 'client_action', icon: '✏️', color: 'bg-amber-100 text-amber-700',     label: 'Cliente pidió cambios' },
  client_comment:            { category: 'client_action', icon: '💬', color: 'bg-pink-100 text-pink-700',       label: 'Comentario del cliente' },
  client_task_created:       { category: 'client_action', icon: '🆕', color: 'bg-indigo-100 text-indigo-700',   label: 'Tarea creada por cliente' },
  client_form_submitted:     { category: 'client_action', icon: '📝', color: 'bg-violet-100 text-violet-700',   label: 'Formulario completado' },
  // Tasks
  task_assigned:             { category: 'task',          icon: '📋', color: 'bg-blue-100 text-blue-700',       label: 'Tarea asignada' },
  task_updated:              { category: 'task',          icon: '🔄', color: 'bg-yellow-100 text-yellow-700',   label: 'Tarea actualizada' },
  task_due:                  { category: 'task',          icon: '⏰', color: 'bg-orange-100 text-orange-700',   label: 'Tarea por vencer' },
  task_completed:            { category: 'task',          icon: '🎉', color: 'bg-emerald-100 text-emerald-700', label: 'Tarea completada' },
  form_assigned:             { category: 'task',          icon: '📝', color: 'bg-violet-100 text-violet-700',   label: 'Formulario asignado' },
  // Comments
  comment:                   { category: 'comment',       icon: '💬', color: 'bg-blue-50 text-blue-700',        label: 'Comentario' },
  mention:                   { category: 'comment',       icon: '@',  color: 'bg-purple-100 text-purple-700',   label: 'Mención' },
  // Finance
  invoice_created:           { category: 'finance',       icon: '🧾', color: 'bg-teal-100 text-teal-700',       label: 'Factura' },
  invoice_paid:              { category: 'finance',       icon: '💰', color: 'bg-emerald-100 text-emerald-700', label: 'Factura pagada' },
  commission_approved:       { category: 'finance',       icon: '💸', color: 'bg-green-100 text-green-700',     label: 'Comisión aprobada' },
  // System
  automation:                { category: 'system',        icon: '🤖', color: 'bg-slate-100 text-slate-700',     label: 'Automatización' },
  chat_message:              { category: 'system',        icon: '💬', color: 'bg-slate-100 text-slate-700',     label: 'Mensaje de chat' },
};

export const NOTIFICATION_CATEGORIES = [
  { id: 'all',           label: 'Todas',     icon: '🔔', color: 'text-gray-700' },
  { id: 'client_action', label: 'Cliente',   icon: '🎯', color: 'text-pink-700' },
  { id: 'task',          label: 'Tareas',    icon: '📋', color: 'text-blue-700' },
  { id: 'comment',       label: 'Comentarios', icon: '💬', color: 'text-purple-700' },
  { id: 'finance',       label: 'Finanzas',  icon: '💰', color: 'text-emerald-700' },
  { id: 'system',        label: 'Sistema',   icon: '🤖', color: 'text-slate-700' },
];

export const getNotificationMeta = (type) =>
  NOTIFICATION_TYPE_META[type] || { category: 'system', icon: '🔔', color: 'bg-gray-100 text-gray-600', label: type || 'Notificación' };

export const notificationsAPI = {
  getByUser: (userId, params = {}) => {
    // Backwards-compat: callers passing `true` as the second arg meant `unread_only`.
    const query = typeof params === 'boolean' ? { unread_only: params } : params;
    return api.get(`/notifications/user/${userId}`, { params: query });
  },
  getUnreadCount: (userId) => api.get(`/notifications/user/${userId}/unread-count`),
  getCategoryCounts: (userId) => api.get(`/notifications/user/${userId}/category-counts`),
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
  getVersions: (id) => api.get(`/notes/${id}/versions`),
  getVersion: (id, versionId) => api.get(`/notes/${id}/versions/${versionId}`),
  restoreVersion: (id, versionId) => api.post(`/notes/${id}/versions/${versionId}/restore`),
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
  // Google Ads
  testGoogleAds: (id) => api.post(`/platform-credentials/google-ads/${id}/test`),
  disconnectGoogleAds: (id) => api.delete(`/platform-credentials/google-ads/${id}`),
  // TikTok Ads
  testTiktok: (id) => api.post(`/platform-credentials/tiktok/${id}/test`),
  disconnectTiktok: (id) => api.delete(`/platform-credentials/tiktok/${id}`),
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
  getGoogleCampaigns: (clientId, startDate, endDate) =>
    api.get(`/client-metrics/${clientId}/google-campaigns`, { params: { start_date: startDate, end_date: endDate } }),
  getTiktokCampaigns: (clientId, startDate, endDate) =>
    api.get(`/client-metrics/${clientId}/tiktok-campaigns`, { params: { start_date: startDate, end_date: endDate } }),
  getTopProducts: (clientId, startDate, endDate) =>
    api.get(`/client-metrics/${clientId}/top-products`, { params: { start_date: startDate, end_date: endDate } }),
};

// Growth Dashboard API
export const growthAPI = {
  getClients: () => api.get('/growth/clients'),
  hideClient: (clientId, isHidden) => api.put(`/growth/clients/${clientId}/hide`, { is_hidden: isHidden }),
  setServiceType: (clientId, serviceType) => api.put(`/growth/clients/${clientId}/service-type`, { service_type: serviceType }),
  getClientData: (clientId, period) => api.get(`/growth/${clientId}`, { params: { period } }),
  // Objectives
  createObjective: (clientId, data) => api.post(`/growth/${clientId}/objectives`, data),
  updateObjective: (id, data) => api.put(`/growth/objectives/${id}`, data),
  // Palancas
  createPalanca: (clientId, data) => api.post(`/growth/${clientId}/palancas`, data),
  updatePalanca: (id, data) => api.put(`/growth/palancas/${id}`, data),
  deletePalanca: (id) => api.delete(`/growth/palancas/${id}`),
  // Milestones
  createMilestone: (clientId, data) => api.post(`/growth/${clientId}/milestones`, data),
  updateMilestone: (id, data) => api.put(`/growth/milestones/${id}`, data),
  deleteMilestone: (id) => api.delete(`/growth/milestones/${id}`),
  // Banderas
  createBandera: (clientId, data) => api.post(`/growth/${clientId}/banderas`, data),
  updateBandera: (id, data) => api.put(`/growth/banderas/${id}`, data),
  deleteBandera: (id) => api.delete(`/growth/banderas/${id}`),
};

// Briefs API
export const briefsAPI = {
  getAll: (clientId) => api.get('/briefs', { params: clientId ? { client_id: clientId } : {} }),
  getById: (id) => api.get(`/briefs/${id}`),
  create: (data) => api.post('/briefs', data),
  update: (id, data) => api.put(`/briefs/${id}`, data),
  delete: (id) => api.delete(`/briefs/${id}`),
};

// Facebook OAuth API
export const facebookOAuthAPI = {
  getAuthUrl: (clientId) => api.get(`/oauth/facebook/url?client_id=${clientId}`),
  getAdAccounts: (sessionId) => api.get(`/oauth/facebook/ad-accounts?session_id=${sessionId}`),
  linkAccounts: (data) => api.post('/oauth/facebook/link-accounts', data),
  unlinkAccount: (credentialId) => api.delete(`/oauth/facebook/unlink/${credentialId}`),
};

// Google Ads OAuth API
export const googleAdsOAuthAPI = {
  getAuthUrl: (clientId) => api.get(`/oauth/google-ads/url?client_id=${clientId}`),
  getCustomers: (sessionId) => api.get(`/oauth/google-ads/customers?session_id=${sessionId}`),
  linkAccounts: (data) => api.post('/oauth/google-ads/link-accounts', data),
  unlinkAccount: (credentialId) => api.delete(`/oauth/google-ads/unlink/${credentialId}`),
};

// TikTok Ads OAuth API
export const tiktokOAuthAPI = {
  getAuthUrl: (clientId) => api.get(`/oauth/tiktok/url?client_id=${clientId}`),
  getAdvertisers: (sessionId) => api.get(`/oauth/tiktok/advertisers?session_id=${sessionId}`),
  linkAccounts: (data) => api.post('/oauth/tiktok/link-accounts', data),
  unlinkAccount: (credentialId) => api.delete(`/oauth/tiktok/unlink/${credentialId}`),
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
  apply: (templateId, projectId, assigneeOverrides = {}) =>
    api.post(`/project-templates/${templateId}/apply`, {
      project_id: projectId,
      assignee_overrides: assigneeOverrides,
    }),
  // Categories
  getCategories: () => api.get('/project-templates/categories/all'),
  createCategory: (name) => api.post('/project-templates/categories', { name }),
  deleteCategory: (name) => api.delete(`/project-templates/categories/${encodeURIComponent(name)}`),
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
  // Dashboard Templates
  getDashboardTemplates: () => api.get('/portal-admin/dashboard-templates'),
  getDashboardTemplate: (id) => api.get(`/portal-admin/dashboard-templates/${id}`),
  createDashboardTemplate: (data) => api.post('/portal-admin/dashboard-templates', data),
  updateDashboardTemplate: (id, data) => api.put(`/portal-admin/dashboard-templates/${id}`, data),
  deleteDashboardTemplate: (id) => api.delete(`/portal-admin/dashboard-templates/${id}`),
  applyDashboardTemplate: (clientId, templateSlug) => api.post(`/portal-admin/clients/${clientId}/apply-template`, { template_slug: templateSlug }),
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

// Task History (feed unificado por tarea)
export const taskHistoryAPI = {
  get: (taskId) => api.get(`/task-history/${taskId}`),
};

// Task Saved Views (vistas favoritas personales de la pestaña Tareas)
export const taskViewsAPI = {
  getAll: () => api.get('/task-views'),
  create: (data) => api.post('/task-views', data),
  update: (id, data) => api.put(`/task-views/${id}`, data),
  delete: (id) => api.delete(`/task-views/${id}`),
  reorder: (ids) => api.put('/task-views/reorder', { ids }),
};

// Client Groups (grupos de clientes para distribuir contenido)
export const clientGroupsAPI = {
  getAll: () => api.get('/client-groups'),
  getById: (id) => api.get(`/client-groups/${id}`),
  create: (data) => api.post('/client-groups', data),
  update: (id, data) => api.put(`/client-groups/${id}`, data),
  delete: (id) => api.delete(`/client-groups/${id}`),
  setMembers: (id, clientIds) => api.put(`/client-groups/${id}/clients`, { client_ids: clientIds }),
  addMember: (id, clientId) => api.post(`/client-groups/${id}/clients`, { client_id: clientId }),
  removeMember: (id, clientId) => api.delete(`/client-groups/${id}/clients/${clientId}`),
};

// Reference Ads (biblioteca de anuncios referente para clientes)
export const referenceAdsAPI = {
  getAll: (filters) => api.get('/reference-ads', { params: filters }),
  getById: (id) => api.get(`/reference-ads/${id}`),
  create: (data) => api.post('/reference-ads', data),
  update: (id, data) => api.put(`/reference-ads/${id}`, data),
  delete: (id) => api.delete(`/reference-ads/${id}`),
};

// UGC (User Generated Content) - Creator Management
export const ugcAPI = {
  // Stages
  getStages: () => api.get('/ugc/stages'),
  createStage: (data) => api.post('/ugc/stages', data),
  updateStage: (id, data) => api.put(`/ugc/stages/${id}`, data),
  deleteStage: (id) => api.delete(`/ugc/stages/${id}`),
  reorderStages: (stages) => api.put('/ugc/stages/reorder', { stages }),
  // Industries
  getIndustries: () => api.get('/ugc/industries'),
  createIndustry: (data) => api.post('/ugc/industries', data),
  deleteIndustry: (id) => api.delete(`/ugc/industries/${id}`),
  // Creators
  getCreators: (filters) => api.get('/ugc/creators', { params: filters }),
  getCreator: (id) => api.get(`/ugc/creators/${id}`),
  createCreator: (data) => api.post('/ugc/creators', data),
  updateCreator: (id, data) => api.put(`/ugc/creators/${id}`, data),
  deleteCreator: (id) => api.delete(`/ugc/creators/${id}`),
  moveCreatorStage: (id, stageId) => api.patch(`/ugc/creators/${id}/stage`, { stage_id: stageId }),
  // Assignments
  getAssignments: (filters) => api.get('/ugc/assignments', { params: filters }),
  getAssignment: (id) => api.get(`/ugc/assignments/${id}`),
  createAssignment: (data) => api.post('/ugc/assignments', data),
  updateAssignment: (id, data) => api.put(`/ugc/assignments/${id}`, data),
  deleteAssignment: (id) => api.delete(`/ugc/assignments/${id}`),
  updateAssignmentStatus: (id, status) => api.patch(`/ugc/assignments/${id}/status`, { status }),
  // Payments
  getPayments: (filters) => api.get('/ugc/payments', { params: filters }),
  createPayment: (data) => api.post('/ugc/payments', data),
  updatePayment: (id, data) => api.put(`/ugc/payments/${id}`, data),
  deletePayment: (id) => api.delete(`/ugc/payments/${id}`),
  // Registration Links
  getRegistrationLinks: () => api.get('/ugc/registration-links'),
  createRegistrationLink: (tag) => api.post('/ugc/registration-links', { tag }),
  deleteRegistrationLink: (id) => api.delete(`/ugc/registration-links/${id}`),
  // Stats
  getStats: () => api.get('/ugc/stats'),
  // Clients with UGC enabled
  getUgcClients: () => api.get('/ugc/clients'),
  // Instagram
  fetchInstagram: (id) => api.post(`/ugc/creators/${id}/fetch-instagram`),
  fetchAllInstagram: () => api.post('/ugc/fetch-all-instagram'),
  // Packages
  getPackages: () => api.get('/ugc/packages'),
  createPackage: (data) => api.post('/ugc/packages', data),
  // Projects (UGC Campaigns)
  getProjectStatuses: () => api.get('/ugc/projects/statuses'),
  getProjects: (filters) => api.get('/ugc/projects', { params: filters }),
  getProject: (id) => api.get(`/ugc/projects/${id}`),
  createProject: (data) => api.post('/ugc/projects', data),
  updateProject: (id, data) => api.put(`/ugc/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/ugc/projects/${id}`),
  addProjectCreators: (projectId, data) => api.post(`/ugc/projects/${projectId}/creators`, data),
  updateProjectCreator: (projectId, creatorId, data) => api.put(`/ugc/projects/${projectId}/creators/${creatorId}`, data),
  removeProjectCreator: (projectId, creatorId) => api.delete(`/ugc/projects/${projectId}/creators/${creatorId}`),
  reorderProjectCreators: (projectId, creatorIds) => api.put(`/ugc/projects/${projectId}/creators/reorder`, { creator_ids: creatorIds }),
  // Google Drive
  getDriveStatus: () => api.get('/ugc/drive/status'),
  createDriveFolder: (projectId, creatorId) => api.post(`/ugc/projects/${projectId}/creators/${creatorId}/drive-folder`),
  createAllDriveFolders: (projectId) => api.post(`/ugc/projects/${projectId}/create-all-folders`),
};

// UGC Public Registration (no auth required)
export const ugcPublicAPI = {
  getRegistrationInfo: (token) => api.get(`/ugc/register/${token}`),
  register: (token, data) => api.post(`/ugc/register/${token}`, data),
};

// Document Templates & Signatures (NDA, Contracts)
export const documentTemplatesAPI = {
  // Templates
  getAll: (filters) => api.get('/document-templates', { params: filters }),
  getById: (id) => api.get(`/document-templates/${id}`),
  create: (data) => api.post('/document-templates', data),
  update: (id, data) => api.put(`/document-templates/${id}`, data),
  delete: (id) => api.delete(`/document-templates/${id}`),
  // Assign to client
  assign: (templateId, clientId, data) => api.post(`/document-templates/${templateId}/assign/${clientId}`, data),
  // Signatures
  getAllSignatures: (filters) => api.get('/document-templates/signatures/all', { params: filters }),
  getClientSignatures: (clientId) => api.get(`/document-templates/signatures/client/${clientId}`),
  getSignature: (signatureId) => api.get(`/document-templates/signatures/${signatureId}`),
  revokeSignature: (signatureId) => api.put(`/document-templates/signatures/${signatureId}/revoke`),
  deleteSignature: (signatureId) => api.delete(`/document-templates/signatures/${signatureId}`),
};

// Zernio (Social Media Management)
export const zernioAPI = {
  // Settings
  getSettings: () => api.get('/zernio/settings'),
  saveSettings: (apiKey) => api.post('/zernio/settings', { api_key: apiKey }),
  testConnection: () => api.post('/zernio/test'),
  disconnect: () => api.delete('/zernio/settings'),

  // Accounts
  getAccounts: (platform) => api.get('/zernio/accounts', { params: { platform } }),
  getAccountHealth: (accountId) => api.get('/zernio/accounts/health', { params: { accountId } }),
  getFollowerStats: (accountId) => api.get(`/zernio/accounts/${accountId}/followers`),

  // Analytics
  getPostAnalytics: (accountId, options = {}) => api.get('/zernio/analytics/posts', { params: { accountId, ...options } }),
  getFollowerAnalytics: (accountId, dateFrom, dateTo) => api.get('/zernio/analytics/followers', { params: { accountId, dateFrom, dateTo } }),
  getDailyMetrics: (accountId, dateFrom, dateTo) => api.get('/zernio/analytics/daily', { params: { accountId, dateFrom, dateTo } }),
  getBestTimes: (accountId, platform) => api.get('/zernio/analytics/best-times', { params: { accountId, platform } }),
  getInstagramInsights: (accountId, dateFrom, dateTo) => api.get('/zernio/analytics/instagram', { params: { accountId, dateFrom, dateTo } }),

  // Posts
  getPosts: (options = {}) => api.get('/zernio/posts', { params: options }),
  getPostQueue: (accountId, limit) => api.get('/zernio/posts/queue', { params: { accountId, limit } }),
  getPost: (postId) => api.get(`/zernio/posts/${postId}`),
  createPost: (data) => api.post('/zernio/posts', data),
  updatePost: (postId, data) => api.put(`/zernio/posts/${postId}`, data),
  deletePost: (postId) => api.delete(`/zernio/posts/${postId}`),
  publishNow: (postId) => api.post(`/zernio/posts/${postId}/publish`),

  // Comments
  getCommentedPosts: (options = {}) => api.get('/zernio/comments/posts', { params: options }),
  getPostComments: (postId, accountId) => api.get(`/zernio/posts/${postId}/comments`, { params: { accountId } }),
  replyToComment: (commentId, accountId, message) => api.post(`/zernio/comments/${commentId}/reply`, { accountId, message }),
  likeComment: (commentId, accountId) => api.post(`/zernio/comments/${commentId}/like`, { accountId }),
  hideComment: (commentId, accountId) => api.post(`/zernio/comments/${commentId}/hide`, { accountId }),
  deleteComment: (commentId, accountId) => api.delete(`/zernio/comments/${commentId}`, { params: { accountId } }),

  // Conversations (Inbox)
  getConversations: (options = {}) => api.get('/zernio/conversations', { params: options }),
  getConversation: (conversationId) => api.get(`/zernio/conversations/${conversationId}`),
  getMessages: (conversationId, limit) => api.get(`/zernio/conversations/${conversationId}/messages`, { params: { limit } }),
  sendMessage: (conversationId, accountId, message) => api.post(`/zernio/conversations/${conversationId}/messages`, { accountId, message }),
  updateConversationStatus: (conversationId, status) => api.patch(`/zernio/conversations/${conversationId}/status`, { status }),

  // Automations
  getAutomations: (options = {}) => api.get('/zernio/automations', { params: options }),
  getAutomation: (automationId) => api.get(`/zernio/automations/${automationId}`),
  createAutomation: (data) => api.post('/zernio/automations', data),
  updateAutomation: (automationId, data) => api.put(`/zernio/automations/${automationId}`, data),
  deleteAutomation: (automationId) => api.delete(`/zernio/automations/${automationId}`),
  getAutomationLogs: (automationId, limit) => api.get(`/zernio/automations/${automationId}/logs`, { params: { limit } }),

  // Media
  uploadMedia: (url, type, altText) => api.post('/zernio/media', { url, type, altText }),
  getMedia: (options = {}) => api.get('/zernio/media', { params: options }),
  deleteMedia: (mediaId) => api.delete(`/zernio/media/${mediaId}`),
};

export default api;
