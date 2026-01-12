import { createContext, useContext, useState, useEffect } from 'react';
import { teamAPI } from '../utils/api';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
    // Load saved user from localStorage
    const savedUserId = localStorage.getItem('currentUserId');
    if (savedUserId) {
      loadUser(savedUserId);
    } else {
      setLoading(false);
    }
  }, []);

  const loadMembers = async () => {
    try {
      const response = await teamAPI.getAll({ status: 'active' });
      setMembers(response.data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const loadUser = async (userId) => {
    try {
      const response = await teamAPI.getById(userId);
      const user = response.data;

      // Parse permissions
      const permissions = user.permissions
        ? JSON.parse(user.permissions)
        : {
            dashboard: true,
            clients: true,
            projects: true,
            tasks: true,
            team: false,
            invoices: false,
            expenses: false,
          };

      setCurrentUser({ ...user, permissions });
      localStorage.setItem('currentUserId', userId);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectUser = (userId) => {
    if (!userId) {
      setCurrentUser(null);
      localStorage.removeItem('currentUserId');
      return;
    }
    loadUser(userId);
  };

  const hasPermission = (permission) => {
    if (!currentUser) return true; // If no user selected, show all (admin mode)
    if (currentUser.role === 'admin') return true; // Admins have all permissions
    return currentUser.permissions?.[permission] === true;
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        members,
        loading,
        selectUser,
        hasPermission,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
