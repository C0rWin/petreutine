import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { User, normalizeUser } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'petreunite_token';
const API_URL = import.meta.env.VITE_API_URL || '';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    try {
      api.setToken(storedToken);
      const response = await api.getCurrentUser();
      if (response.data) {
        setUser(normalizeUser(response.data));
        setToken(storedToken);
      } else {
        // Token invalid, clear it
        localStorage.removeItem(TOKEN_KEY);
        api.setToken(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem(TOKEN_KEY);
      api.setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle OAuth callback token
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const callbackToken = urlParams.get('token');

    if (callbackToken) {
      // Store token and clean URL
      localStorage.setItem(TOKEN_KEY, callbackToken);
      api.setToken(callbackToken);

      // Remove token from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Fetch user info
      checkAuth();
    } else {
      checkAuth();
    }
  }, [checkAuth]);

  const login = () => {
    // Redirect to Yandex OAuth
    window.location.href = `${API_URL}/api/auth/yandex`;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      api.setToken(null);
      setUser(null);
      setToken(null);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
