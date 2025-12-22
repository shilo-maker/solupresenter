import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';
import { changeLanguage, getCurrentLanguage } from '../i18n';

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

  // Apply user's language preference when user is loaded
  useEffect(() => {
    if (user?.preferences?.language) {
      changeLanguage(user.preferences.language);
    }
  }, [user]);

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

      // Check if error is due to unverified email
      if (error.response?.data?.requiresVerification) {
        return {
          success: false,
          requiresVerification: true,
          email: error.response.data.email,
          error: error.response.data.error
        };
      }

      const errorMessage = error.response?.data?.error || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const register = async (email, password) => {
    try {
      setError(null);
      const currentLanguage = getCurrentLanguage();
      const response = await authAPI.register(email, password, currentLanguage);

      // Check if registration requires email verification
      if (response.data.requiresVerification) {
        return {
          success: true,
          requiresVerification: true,
          message: response.data.message,
          email: response.data.user.email
        };
      }

      // If no verification required (shouldn't happen with new flow, but keeping for backward compatibility)
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setUser(response.data.user);
      }

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

  // Refresh user data from server
  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await authAPI.getCurrentUser();
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    googleLogin,
    refreshUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.isAdmin === true
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
