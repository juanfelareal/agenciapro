import { createContext, useContext, useState, useEffect } from 'react';
import { portalAuthAPI } from '../utils/portalApi';

const PortalContext = createContext();

export function PortalProvider({ children }) {
  const [client, setClient] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('portalToken');
    if (token) {
      validateSession();
    } else {
      setLoading(false);
    }
  }, []);

  const validateSession = async () => {
    try {
      const response = await portalAuthAPI.getMe();
      setClient(response.client);
      setPermissions(response.permissions);
      setWelcomeMessage(response.welcome_message);
      setIsAuthenticated(true);
    } catch (error) {
      // Invalid token, clear it
      localStorage.removeItem('portalToken');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (code) => {
    try {
      const response = await portalAuthAPI.login(code);

      // Store token
      localStorage.setItem('portalToken', response.token);

      // Update state
      setClient(response.client);
      setPermissions(response.permissions);
      setWelcomeMessage(response.welcome_message);
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al iniciar sesión'
      };
    }
  };

  const logout = async () => {
    try {
      await portalAuthAPI.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('portalToken');
      setClient(null);
      setPermissions(null);
      setWelcomeMessage(null);
      setIsAuthenticated(false);
    }
  };

  const hasPermission = (permission) => {
    if (!permissions) return false;
    return !!permissions[permission];
  };

  const value = {
    client,
    permissions,
    welcomeMessage,
    loading,
    isAuthenticated,
    login,
    logout,
    hasPermission,
  };

  return (
    <PortalContext.Provider value={value}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
}

export default PortalContext;
