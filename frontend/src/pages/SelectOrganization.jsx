import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SelectOrganization = () => {
  const { isAuthenticated, organizations, currentOrg, switchOrg, loading: authLoading } = useAuth();
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <div className="card p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-ink-600 text-center">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If only 1 org, redirect to dashboard
  if (organizations.length <= 1) {
    return <Navigate to="/" replace />;
  }

  const handleSelectOrg = async (orgId) => {
    setSwitching(true);
    const result = await switchOrg(orgId);
    setSwitching(false);

    if (result.success) {
      navigate('/', { replace: true });
      // Reload to refresh all data
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-ink-900 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Selecciona una organizacion</h1>
          <p className="text-ink-500 mt-2">Elige el workspace en el que quieres trabajar</p>
        </div>

        <div className="space-y-3">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSelectOrg(org.id)}
              disabled={switching}
              className="card w-full p-4 flex items-center gap-4 hover:shadow-md transition-all duration-200 disabled:opacity-50 group"
            >
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="w-12 h-12 rounded-xl object-contain" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center">
                  <Building2 size={24} className="text-ink-500" />
                </div>
              )}
              <div className="flex-1 text-left min-w-0">
                <p className="text-base font-semibold text-ink-900 truncate">{org.name}</p>
                <p className="text-sm text-ink-500">
                  {org.role === 'admin' ? 'Administrador' : org.role === 'manager' ? 'Manager' : 'Miembro'}
                </p>
              </div>
              <ArrowRight
                size={20}
                className="text-ink-300 group-hover:text-ink-600 group-hover:translate-x-1 transition-all"
              />
              {org.id === currentOrg?.id && (
                <span className="text-xs bg-accent/10 text-accent font-medium px-2 py-1 rounded-full">Actual</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SelectOrganization;
