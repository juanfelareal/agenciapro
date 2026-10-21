import { createContext, useContext, useState, useEffect } from 'react';
import { portalAuthAPI } from '../utils/portalApi';
import { applyBranding } from '../branding/applyBranding'; // [branding]

const PortalContext = createContext();

export function PortalProvider({ children }) {
  const [client, setClient] = useState(null);
  const [agency, setAgency] = useState(null); // [branding] { name, logo_url, branding } de la agencia
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

  // [branding] El portal se ve con la marca de la agencia (acento, tema, logo) en vivo.
  useEffect(() => {
    if (agency) applyBranding(agency.branding, { scope: 'portal', org: agency });
  }, [agency]);

  const applyResponse = (response) => {
    setClient(response.client);
    setAgency(response.agency || null);
    setPermissions(response.permissions);
    // Mensaje del cliente; si no tiene, el de bienvenida configurado por la agencia
    setWelcomeMessage(response.welcome_message || response.agency?.branding?.portal_welcome || null);
    setIsAuthenticated(true);
  };

  const validateSession = async () => {
    try {
      const response = await portalAuthAPI.getMe();
      applyResponse(response);
    } catch {
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
      applyResponse(response);

      return { success: true, client: response.client };
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
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('portalToken');
      setClient(null);
      setAgency(null);
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
    agency,
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
