import axios from 'axios';
import { getDb, saveDatabase } from '../database';

// Timeout for all auth requests (15 seconds)
const AUTH_REQUEST_TIMEOUT = 15000;

export interface User {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  preferences?: {
    language?: string;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  serverUrl: string;
}

const DEFAULT_SERVER_URL = 'https://solupresenter-backend-4rn5.onrender.com';

class AuthService {
  private state: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    serverUrl: DEFAULT_SERVER_URL
  };

  /**
   * Initialize auth from stored settings
   */
  async initialize(): Promise<AuthState> {
    const db = getDb();
    if (!db) {
      return this.state;
    }

    try {
      const result = db.exec('SELECT onlineToken, onlineServerUrl FROM settings WHERE id = 1');
      if (result.length > 0 && result[0].values.length > 0) {
        const [token, serverUrl] = result[0].values[0] as [string | null, string | null];

        if (token) {
          this.state.token = token;
          this.state.serverUrl = serverUrl || DEFAULT_SERVER_URL;

          // Verify token is still valid
          try {
            const user = await this.getCurrentUser();
            if (user) {
              this.state.isAuthenticated = true;
              this.state.user = user;
            } else {
              // Token invalid, clear it
              this.clearAuth();
            }
          } catch (error) {
            console.error('Token verification failed:', error);
            this.clearAuth();
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }

    return this.state;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string, serverUrl?: string): Promise<{ success: boolean; error?: string; requiresVerification?: boolean }> {
    const url = serverUrl || this.state.serverUrl;

    try {
      const response = await axios.post(`${url}/auth/login`, {
        email,
        password
      }, { timeout: AUTH_REQUEST_TIMEOUT });

      const { token, user } = response.data;

      this.state.token = token;
      this.state.user = user;
      this.state.isAuthenticated = true;
      this.state.serverUrl = url;

      // Save to database
      this.saveAuthToDb();

      return { success: true };
    } catch (error: any) {
      console.error('Login failed:', error.response?.data || error.message);

      if (error.response?.data?.requiresVerification) {
        return {
          success: false,
          requiresVerification: true,
          error: error.response.data.error
        };
      }

      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  }

  /**
   * Register new account
   */
  async register(email: string, password: string, serverUrl?: string): Promise<{ success: boolean; error?: string; requiresVerification?: boolean; message?: string }> {
    const url = serverUrl || this.state.serverUrl;

    try {
      const response = await axios.post(`${url}/auth/register`, {
        email,
        password,
        language: 'he'
      }, { timeout: AUTH_REQUEST_TIMEOUT });

      if (response.data.requiresVerification) {
        return {
          success: true,
          requiresVerification: true,
          message: response.data.message
        };
      }

      // If somehow we get a token back (shouldn't happen with email verification)
      if (response.data.token) {
        this.state.token = response.data.token;
        this.state.user = response.data.user;
        this.state.isAuthenticated = true;
        this.state.serverUrl = url;
        this.saveAuthToDb();
      }

      return { success: true };
    } catch (error: any) {
      console.error('Registration failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  }

  /**
   * Get current user from server
   */
  async getCurrentUser(): Promise<User | null> {
    if (!this.state.token) {
      return null;
    }

    try {
      const response = await axios.get(`${this.state.serverUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${this.state.token}`
        },
        timeout: AUTH_REQUEST_TIMEOUT
      });

      return response.data.user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Logout
   */
  logout(): void {
    this.clearAuth();
  }

  /**
   * Get current auth state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Get auth token for socket connection
   */
  getToken(): string | null {
    return this.state.token;
  }

  /**
   * Get server URL
   */
  getServerUrl(): string {
    return this.state.serverUrl;
  }

  /**
   * Get user ID for socket connection
   */
  getUserId(): string | null {
    return this.state.user?.id || null;
  }

  /**
   * Set server URL
   */
  setServerUrl(url: string): void {
    this.state.serverUrl = url;
    this.saveAuthToDb();
  }

  private clearAuth(): void {
    this.state.token = null;
    this.state.user = null;
    this.state.isAuthenticated = false;
    this.saveAuthToDb();
  }

  private saveAuthToDb(): void {
    const db = getDb();
    if (!db) return;

    try {
      db.run(
        'UPDATE settings SET onlineToken = ?, onlineServerUrl = ? WHERE id = 1',
        [this.state.token, this.state.serverUrl]
      );
      saveDatabase();
    } catch (error) {
      console.error('Failed to save auth to database:', error);
    }
  }
}

export const authService = new AuthService();
