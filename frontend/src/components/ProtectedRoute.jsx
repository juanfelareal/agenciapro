import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const ProtectedRoute = ({ children, permission }) => {
  const { hasPermission, loading } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">
            No tienes permisos para acceder a esta sección.
          </p>
          <p className="text-sm text-gray-500">
            Contacta al administrador si crees que deberías tener acceso.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
