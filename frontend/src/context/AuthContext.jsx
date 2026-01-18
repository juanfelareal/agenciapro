import { createContext, useContext, useState, useEffect } from 'react';
import { teamAPI, setAuthToken } from '../utils/api';

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
      const response = await teamAPI.getMe();
      setUser(response.data.user);
    } catch (err) {
      // Token invalid or expired
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, pin) => {
    setError(null);
    try {
      const response = await teamAPI.login(email, pin);
      const { token, user: userData } = response.data;

      // Save to localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(userData));

      // Set token in API headers
      setAuthToken(token);

      setUser(userData);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Error al iniciar sesión';
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await teamAPI.logout();
    } catch (err) {
      // Ignore errors on logout
    }

    // Clear local state
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setAuthToken(null);
    setUser(null);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.[permission] === true;
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated,
        isAdmin,
        isManager,
        login,
        logout,
        hasPermission,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
