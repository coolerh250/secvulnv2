import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';
import { ROLES } from '../styles/tokens';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(res => setCurrentUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await authApi.login(username, password);
    localStorage.setItem('token', res.data.token);
    setCurrentUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
  };

  const can = (module, action = 'view') => {
    if (!currentUser) return false;
    const role = ROLES[currentUser.role];
    return role?.permissions?.[module]?.[action] === true;
  };

  const canAssignRole = (targetRole) => {
    if (!currentUser) return false;
    const allowed = ROLES[currentUser.role]?.permissions?.users?.assignRole || [];
    return allowed.includes(targetRole);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout, can, canAssignRole, ROLES }}>
      {children}
    </AuthContext.Provider>
  );
}
