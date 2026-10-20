// [modules] Plan, módulos, límites y uso de la organización actual.
// Se carga al iniciar sesión (y al cambiar de organización) desde GET /api/org/plan.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { orgAPI } from '../utils/orgApi';
import { OrgPlanContext } from '../hooks/useOrgPlan';

const storageKey = (orgId) => `orbitPlan:${orgId || 'default'}`;

const readCached = (orgId) => {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const OrgPlanProvider = ({ children }) => {
  const { isAuthenticated, currentOrg, user } = useAuth();
  const orgId = currentOrg?.id || null;
  const [data, setData] = useState(() => readCached(orgId));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const res = await orgAPI.getPlan();
      setData(res.data);
      try { localStorage.setItem(storageKey(res.data?.org_id || orgId), JSON.stringify(res.data)); } catch { /* ignore */ }
    } catch {
      // Sin respuesta: conservamos lo que haya (caché) y no bloqueamos la UI
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, orgId]);

  useEffect(() => {
    setData(readCached(orgId));
    refresh();
  }, [refresh, orgId]);

  // Otras pantallas (Módulos, Suscripción, Plataforma) avisan cuando cambian el plan
  useEffect(() => {
    const onChanged = () => { refresh(); };
    window.addEventListener('orbit:plan-changed', onChanged);
    return () => window.removeEventListener('orbit:plan-changed', onChanged);
  }, [refresh]);

  const value = useMemo(() => {
    const modules = data?.modules || null;
    const catalog = data?.catalog || null;
    const isModuleEnabled = (key) => {
      if (!key) return true;
      if (key === 'dashboard') return true;
      if (!modules) return true; // aún sin datos: no ocultamos nada
      return modules[key] !== false;
    };
    const requiredPlanFor = (key) => catalog?.modules?.find((m) => m.key === key)?.required_plan || null;
    return {
      loading,
      loaded: !!data,
      plan: data?.plan || null,
      planName: data?.plan_name || null,
      status: data?.status || null,
      trialEndsAt: data?.trial_ends_at || null,
      daysLeft: data?.days_left ?? null,
      trialExpired: !!data?.trial_expired,
      writesBlocked: !!data?.writes_blocked,
      planSelected: data?.plan_selected || null,
      planRequestedAt: data?.plan_requested_at || null,
      limits: data?.limits || {},
      usage: data?.usage || {},
      modules,
      overrides: data?.overrides || {},
      catalog,
      isPlatformAdmin: !!(data?.is_platform_admin ?? user?.is_platform_admin),
      isModuleEnabled,
      requiredPlanFor,
      refresh,
    };
  }, [data, loading, refresh, user?.is_platform_admin]);

  return <OrgPlanContext.Provider value={value}>{children}</OrgPlanContext.Provider>;
};

