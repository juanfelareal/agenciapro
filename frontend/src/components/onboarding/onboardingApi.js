/**
 * Cliente HTTP del onboarding (usa la instancia axios de utils/api con token y manejo de 401).
 * Rutas: backend/src/routes/org-onboarding.js
 */
import api from '../../utils/api';

export const onboardingAPI = {
  get: () => api.get('/org/onboarding'),
  update: (patch) => api.put('/org/onboarding', patch),
  status: () => api.get('/org/onboarding/status'),
  getModules: () => api.get('/org/modules'),
  setModules: (modules) => api.put('/org/modules', { modules }),
  setBranding: (branding) => api.put('/org/branding', branding),
};

/** Evento global para que Layout abra/cierre el drawer del menú en móvil durante el tour. */
export const TOUR_MENU_EVENT = 'orbit:tour-menu';
export const requestMenu = (open) => window.dispatchEvent(new CustomEvent(TOUR_MENU_EVENT, { detail: { open } }));
/** Evento para que Mi Cuenta pueda relanzar el tour sin recargar. */
export const TOUR_START_EVENT = 'orbit:tour-start';
export const startTour = () => window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
/** Evento para refrescar el checklist cuando cambia el estado del onboarding (p. ej. desde Mi Cuenta). */
export const ONBOARDING_CHANGED_EVENT = 'orbit:onboarding-changed';
