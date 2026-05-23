import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service';
import {
  clearStoredSession,
  ensureValidAccessToken,
  getRefreshToken,
  persistSession,
  startSessionRefreshScheduler,
  stopSessionRefreshScheduler,
  subscribeToAuthSessionChanges,
} from '@/lib/authSession';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  level?: number;
  xp?: number;
  skip_tokens_remaining?: number;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; full_name: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadUserProfile(): Promise<User | null> {
  const profile = await authService.getCurrentUser();
  return profile as User | null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateUser = useCallback(async (): Promise<boolean> => {
    const token = await ensureValidAccessToken();
    if (!token && !getRefreshToken()) {
      setUser(null);
      return false;
    }

    try {
      const profile = await loadUserProfile();
      if (profile) {
        setUser(profile);
        startSessionRefreshScheduler();
        return true;
      }
    } catch (firstError) {
      const renewed = await ensureValidAccessToken();
      if (renewed) {
        try {
          const profile = await loadUserProfile();
          if (profile) {
            setUser(profile);
            startSessionRefreshScheduler();
            return true;
          }
        } catch (retryError) {
          console.error('Auth profile load failed after refresh', retryError);
        }
      }
      console.error('Auth profile load failed', firstError);
    }

    if (!getRefreshToken()) {
      clearStoredSession();
    }
    setUser(null);
    stopSessionRefreshScheduler();
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      if (!cancelled) {
        await hydrateUser();
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    void initAuth();

    const unsubscribe = subscribeToAuthSessionChanges((session) => {
      if (session?.access_token) {
        persistSession(session);
      } else if (!getRefreshToken()) {
        setUser(null);
        stopSessionRefreshScheduler();
      }
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void ensureValidAccessToken();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      unsubscribe?.();
      document.removeEventListener('visibilitychange', onVisibility);
      stopSessionRefreshScheduler();
    };
  }, [hydrateUser]);

  const login = async (credentials: { email: string; password: string }) => {
    await authService.signin(credentials);
    const ok = await hydrateUser();
    if (!ok) {
      throw new Error('Signed in but could not load your profile');
    }
  };

  const register = async (data: { email: string; password: string; full_name: string }) => {
    const response = await authService.signup(data);
    if (response.session?.access_token) {
      const ok = await hydrateUser();
      if (!ok) {
        throw new Error('Account created but could not load your profile');
      }
    }
  };

  const logout = async () => {
    try {
      await authService.signout();
    } catch (error) {
      console.error('Signout error:', error);
    } finally {
      setUser(null);
      stopSessionRefreshScheduler();
      clearStoredSession();
      window.location.href = '/signin';
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
