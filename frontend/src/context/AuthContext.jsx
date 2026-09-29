import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/authService.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('nudge_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nudge_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyStoredAuth = async () => {
      if (token) {
        try {
          const res = await getMe();
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('nudge_user', JSON.stringify(res.user));
          }
        } catch (err) {
          // Token is invalid/expired
          logout();
        }
      }
      setIsLoading(false);
    };

    verifyStoredAuth();
  }, [token]);

  const login = (newToken, newUser) => {
    localStorage.setItem('nudge_token', newToken);
    localStorage.setItem('nudge_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('nudge_token');
    localStorage.removeItem('nudge_user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('nudge_user', JSON.stringify(updatedUser));
  };

  const value = {
    token,
    user,
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    logout,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
