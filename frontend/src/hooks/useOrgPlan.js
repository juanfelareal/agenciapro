// [modules] Contexto y hook del plan de la organización. El Provider vive en
// context/OrgPlanContext.jsx (archivo solo de componentes, para fast refresh).
import { createContext, useContext } from 'react';

export const OrgPlanContext = createContext(null);

// Fuera del provider (p. ej. /print/...) todo se considera habilitado.
export const ORG_PLAN_FALLBACK = {
  loading: false,
  loaded: false,
  plan: null,
  planName: null,
  status: null,
  trialEndsAt: null,
  daysLeft: null,
  trialExpired: false,
  writesBlocked: false,
  planSelected: null,
  planRequestedAt: null,
  limits: {},
  usage: {},
  modules: null,
  overrides: {},
  catalog: null,
  isPlatformAdmin: false,
  isModuleEnabled: () => true,
  requiredPlanFor: () => null,
  refresh: async () => {},
};

export const useOrgPlan = () => useContext(OrgPlanContext) || ORG_PLAN_FALLBACK;
