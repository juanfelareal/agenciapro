import { Navigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { ShieldX, Loader2 } from 'lucide-react';

export default function PortalProtectedRoute({ children, permission }) {
  const { isAuthenticated, loading, hasPermission } = usePortal();

  // Show loading spinner
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-ink-400 animate-spin" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/portal/login" replace />;
  }

  // Check permission if required
  if (permission && !hasPermission(permission)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
          <ShieldX className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-ink-900">Acceso Denegado</h2>
        <p className="text-ink-500 mt-2">
          No tienes permiso para ver esta sección.
        </p>
      </div>
    );
  }

  return children;
}
