import { createContext, useContext, useState, useEffect } from 'react';
import { teamAPI, authAPI, setAuthToken } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoading(false);
      return;
    }

    // Set token in API headers
    setAuthToken(token);

    try {
      // Try new auth endpoint first, fall back to legacy
      let response;
      try {
        response = await authAPI.getMe();
      } catch (e) {
        // Fallback to legacy endpoint
        response = await teamAPI.getMe();
      }

      const data = response.data;
      setUser(data.user);

      if (data.current_org) {
        setCurrentOrg(data.current_org);
        localStorage.setItem('currentOrg', JSON.stringify(data.current_org));
      } else {
        // Try to restore from localStorage
        const savedOrg = localStorage.getItem('currentOrg');
        if (savedOrg) {
          try { setCurrentOrg(JSON.parse(savedOrg)); } catch (e) { /* ignore */ }
        }
      }

      if (data.organizations) {
        setOrganizations(data.organizations);
      }
    } catch (err) {
      // Token invalid or expired
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      localStorage.removeItem('currentOrg');
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, pin) => {
    setError(null);
    try {
      // Try new auth endpoint first
      let response;
      try {
        response = await authAPI.login(email, pin);
      } catch (e) {
        // Fallback to legacy login
        response = await teamAPI.login(email, pin);
      }

      const { token, user: userData, current_org, organizations: orgs } = response.data;

      // Save to localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(userData));

      if (current_org) {
        localStorage.setItem('currentOrg', JSON.stringify(current_org));
      }

      // Set token in API headers
      setAuthToken(token);

      setUser(userData);
      setCurrentOrg(current_org || null);
      setOrganizations(orgs || []);

      // If multiple orgs, signal that org selector should show
      const needsOrgSelection = orgs && orgs.length > 1;

      return { success: true, needsOrgSelection };
    } catch (err) {
      const message = err.response?.data?.error || 'Error al iniciar sesión';
      setError(message);
      return { success: false, error: message };
    }
  };

  const switchOrg = async (orgId) => {
    try {
      const response = await authAPI.selectOrg(orgId);
      const { user: userData, current_org } = response.data;

      setUser(userData);
      setCurrentOrg(current_org);
      localStorage.setItem('authUser', JSON.stringify(userData));
      localStorage.setItem('currentOrg', JSON.stringify(current_org));

      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Error al cambiar de organización';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout().catch(() => {
        // Try legacy logout as fallback
        return teamAPI.logout();
      });
    } catch (err) {
      // Ignore errors on logout
    }

    // Clear local state
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('currentOrg');
    setAuthToken(null);
    setUser(null);
    setCurrentOrg(null);
    setOrganizations([]);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.[permission] === true;
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const hasMultipleOrgs = organizations.length > 1;

  return (
    <AuthContext.Provider
      value={{
        user,
        currentOrg,
        organizations,
        loading,
        error,
        isAuthenticated,
        isAdmin,
        isManager,
        hasMultipleOrgs,
        login,
        logout,
        switchOrg,
        hasPermission,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
