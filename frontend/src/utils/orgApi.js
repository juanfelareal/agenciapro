// [modules] Cliente HTTP de plan/módulos (org actual) y panel de plataforma (LA REAL).
import api from './api';

export const orgAPI = {
  getPlan: () => api.get('/org/plan'),
  getModules: () => api.get('/org/modules'),
  updateModules: (modules) => api.put('/org/modules', { modules }),
  requestPlan: (plan) => api.put('/org/plan', { plan }),
  // [billing] Add-ons: body parcial { hourly_reports?, owner_reports?, dedicated_number?: bool, extra_users?, extra_brands?: int }
  // → { addons, addons_included, limits }. 402 { error, upgrade: true, required_plan } si el plan no lo permite.
  updateAddons: (patch) => api.put('/org/addons', patch),
};

export const platformAPI = {
  listOrganizations: () => api.get('/platform/organizations'),
  updateOrganizationPlan: (id, data) => api.put(`/platform/organizations/${id}/plan`, data),
};
