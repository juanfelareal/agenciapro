// [modules] Cliente HTTP de plan/módulos (org actual) y panel de plataforma (LA REAL).
import api from './api';

export const orgAPI = {
  getPlan: () => api.get('/org/plan'),
  getModules: () => api.get('/org/modules'),
  updateModules: (modules) => api.put('/org/modules', { modules }),
  requestPlan: (plan) => api.put('/org/plan', { plan }),
};

export const platformAPI = {
  listOrganizations: () => api.get('/platform/organizations'),
  updateOrganizationPlan: (id, data) => api.put(`/platform/organizations/${id}/plan`, data),
};
