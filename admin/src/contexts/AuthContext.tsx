import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { User } from '../types';
import { adminApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (token: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_TOKEN_KEY = 'admin_auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchCurrentUser = useCallback(async (authToken: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        return false;
      }

      const userData = await response.json();
      setUser(userData);

      // Check if user has admin role
      const rolesResponse = await fetch('/api/admin/stats/overview', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (rolesResponse.ok) {
        setIsAdmin(true);
        return true;
      } else {
        setIsAdmin(false);
        return false;
      }
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (storedToken) {
        adminApi.setToken(storedToken);
        const success = await fetchCurrentUser(storedToken);
        if (success) {
          setToken(storedToken);
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          adminApi.setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [fetchCurrentUser]);

  const login = async (authToken: string): Promise<boolean> => {
    adminApi.setToken(authToken);
    const success = await fetchCurrentUser(authToken);
    if (success) {
      setToken(authToken);
      localStorage.setItem(AUTH_TOKEN_KEY, authToken);
      return true;
    }
    adminApi.setToken(null);
    return false;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAdmin(false);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    adminApi.setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
