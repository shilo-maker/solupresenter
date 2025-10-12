import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

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
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await authAPI.getCurrentUser();
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      console.log('🔐 Attempting login for:', email);
      const response = await authAPI.login(email, password);
      console.log('✅ Login successful:', response.data);
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      console.error('❌ Login error:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      const errorMessage = error.response?.data?.error || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const register = async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.register(email, password);
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const googleLogin = () => {
    authAPI.googleAuth();
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    googleLogin,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.isAdmin === true
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
