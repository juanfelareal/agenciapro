import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrgPlan } from '../hooks/useOrgPlan'; // [modules]
import { moduleForPath } from '../utils/modules'; // [modules]
import ModuleDisabled from './plan/ModuleDisabled'; // [modules]

const ProtectedRoute = ({ children, permission, module }) => {
  const { isAuthenticated, hasPermission, loading } = useAuth();
  const { isModuleEnabled } = useOrgPlan(); // [modules]
  const location = useLocation(); // [modules]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-ink-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // [modules] Módulo apagado para la organización (prop `module` o inferido de la ruta)
  const moduleKey = module || moduleForPath(location.pathname);
  if (moduleKey && !isModuleEnabled(moduleKey)) {
    return <ModuleDisabled module={moduleKey} />;
  }

  // Check permission if specified
  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-xl font-semibold text-ink-900 mb-2">Acceso Denegado</h2>
          <p className="text-ink-500 mb-4">
            No tienes permisos para acceder a esta sección.
          </p>
          <p className="text-sm text-ink-400">
            Contacta al administrador si crees que deberías tener acceso.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
