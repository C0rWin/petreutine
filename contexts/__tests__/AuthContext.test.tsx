import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';
import { api } from '../../services/api';
import React from 'react';

// Mock the api module
vi.mock('../../services/api', () => ({
  api: {
    setToken: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock window.location
const mockLocation = {
  search: '',
  pathname: '/',
  href: '',
};
Object.defineProperty(window, 'location', {
  writable: true,
  value: mockLocation,
});

// Mock window.history
Object.defineProperty(window, 'history', {
  writable: true,
  value: {
    replaceState: vi.fn(),
  },
});

// Test component that uses the hook
const TestComponent: React.FC<{ onAuthChange?: (isAuthenticated: boolean) => void }> = ({ onAuthChange }) => {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  React.useEffect(() => {
    onAuthChange?.(isAuthenticated);
  }, [isAuthenticated, onAuthChange]);

  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }

  return (
    <div>
      <div data-testid="authenticated">{isAuthenticated ? 'true' : 'false'}</div>
      {user && <div data-testid="user-name">{user.name}</div>}
      <button onClick={login}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocation.search = '';
    mockLocation.pathname = '/';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });
  });

  describe('AuthProvider', () => {
    it('starts with isLoading true and becomes false', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });
    });

    it('shows unauthenticated when no token stored', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });
    });

    it('checks auth with stored token', async () => {
      const mockUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' };
      mockLocalStorage.getItem.mockReturnValue('stored-token');
      (api.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(api.setToken).toHaveBeenCalledWith('stored-token');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
        expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      });
    });

    it('clears token when user fetch fails', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-token');
      (api.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'Invalid token' });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('petreunite_token');
        expect(api.setToken).toHaveBeenCalledWith(null);
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });
    });

    it('handles OAuth callback with token in URL', async () => {
      const mockUser = { id: 'user-1', name: 'OAuth User', email: 'oauth@example.com' };
      mockLocation.search = '?token=oauth-token';
      (api.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Verify token was stored (this happens synchronously)
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('petreunite_token', 'oauth-token');
      });

      await waitFor(() => {
        expect(api.setToken).toHaveBeenCalledWith('oauth-token');
      });

      await waitFor(() => {
        expect(window.history.replaceState).toHaveBeenCalled();
      });
    });

    it('redirects to Yandex OAuth on login', async () => {
      const user = userEvent.setup();

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Login'));

      expect(mockLocation.href).toBe('/api/auth/yandex');
    });

    it('clears auth state on logout', async () => {
      const mockUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' };
      mockLocalStorage.getItem.mockReturnValue('stored-token');
      (api.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockUser });
      (api.logout as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } });

      const user = userEvent.setup();

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });

      await user.click(screen.getByText('Logout'));

      await waitFor(() => {
        expect(api.logout).toHaveBeenCalled();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('petreunite_token');
        expect(api.setToken).toHaveBeenCalledWith(null);
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });
    });

    it('handles logout error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' };
      mockLocalStorage.getItem.mockReturnValue('stored-token');
      (api.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockUser });
      (api.logout as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      });

      await user.click(screen.getByText('Logout'));

      await waitFor(() => {
        // Should still clear local state even if API fails
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('petreunite_token');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });

      consoleError.mockRestore();
    });

    it('handles auth check exception', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.getItem.mockReturnValue('stored-token');
      (api.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('petreunite_token');
        expect(api.setToken).toHaveBeenCalledWith(null);
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });

      consoleError.mockRestore();
    });
  });
});
