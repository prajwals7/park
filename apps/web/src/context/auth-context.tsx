'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'COLLECTOR' | 'ADMIN' | 'SUPER_ADMIN';
  gate: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string; gate?: string }) => Promise<{ success: boolean; error?: string; requires2FA?: boolean }>;
  verify2FA: (totpCode: string) => Promise<{ success: boolean; error?: string }>;
  quickDemoLogin: (role: 'COLLECTOR' | 'ADMIN', gate?: string) => void;
  logout: () => void;
  setGate: (gate: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'wpd_auth_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUser, setPendingUser] = useState<{ user: AuthUser; token?: string } | null>(null);
  const router = useRouter();

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed?.user) {
          setUser(parsed.user);
          setToken(parsed.token || null);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSession = (authUser: AuthUser, authToken: string | null = null) => {
    setUser(authUser);
    setToken(authToken);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: authUser, token: authToken, savedAt: new Date().toISOString() })
      );
    } catch {
      // ignore storage quota issues
    }
  };

  const login = async (credentials: { email: string; password: string; gate?: string }) => {
    const selectedGate = credentials.gate || 'G2';
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Fallback for offline/demo if API is unreachable or returns 401 with standard demo credentials
        if (credentials.email.includes('collector') && credentials.password === 'Admin@12345') {
          const demoUser: AuthUser = {
            id: 'demo-collector',
            name: 'Anand Murthy',
            email: credentials.email,
            role: 'COLLECTOR',
            gate: selectedGate,
          };
          saveSession(demoUser);
          return { success: true };
        }
        if (credentials.email.includes('admin') && credentials.password === 'Admin@12345') {
          const demoUser: AuthUser = {
            id: 'demo-admin',
            name: 'Sunita Rao',
            email: credentials.email,
            role: 'ADMIN',
            gate: selectedGate,
          };
          saveSession(demoUser);
          return { success: true };
        }
        return { success: false, error: data.message || 'Invalid credentials' };
      }

      if (data.requires2FA) {
        setPendingUser({
          user: {
            id: data.user?.id || 'u-pending',
            name: data.user?.name || 'Staff User',
            email: credentials.email,
            role: data.user?.role || 'COLLECTOR',
            gate: selectedGate,
          },
          token: data.tempToken,
        });
        return { success: false, requires2FA: true };
      }

      const loggedUser: AuthUser = {
        id: data.user?.id || 'u-active',
        name: data.user?.name || credentials.email.split('@')[0],
        email: data.user?.email || credentials.email,
        role: data.user?.role || 'COLLECTOR',
        gate: selectedGate,
      };

      saveSession(loggedUser, data.accessToken || null);
      return { success: true };
    } catch {
      // Network or offline fallback for seeded accounts
      if (credentials.password === 'Admin@12345') {
        const isCollector = credentials.email.toLowerCase().includes('collector');
        const fallbackUser: AuthUser = {
          id: isCollector ? 'demo-collector' : 'demo-admin',
          name: isCollector ? 'Anand Murthy (Collector)' : 'Sunita Rao (Admin)',
          email: credentials.email,
          role: isCollector ? 'COLLECTOR' : 'ADMIN',
          gate: selectedGate,
        };
        saveSession(fallbackUser);
        return { success: true };
      }
      return { success: false, error: 'Network error connecting to login service' };
    }
  };

  const verify2FA = async (totpCode: string) => {
    if (!pendingUser) {
      return { success: false, error: 'No 2FA verification in progress' };
    }
    try {
      const res = await fetch('/api/v1/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode, tempToken: pendingUser.token }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || 'Invalid 2FA code' };
      }
      saveSession(pendingUser.user, data.accessToken || null);
      setPendingUser(null);
      return { success: true };
    } catch {
      // offline dev bypass if code is 123456
      if (totpCode === '123456') {
        saveSession(pendingUser.user);
        setPendingUser(null);
        return { success: true };
      }
      return { success: false, error: '2FA verification failed' };
    }
  };

  const quickDemoLogin = (role: 'COLLECTOR' | 'ADMIN', gate: string = 'G2') => {
    const demoUser: AuthUser = {
      id: role === 'COLLECTOR' ? 'collector-1' : 'admin-1',
      name: role === 'COLLECTOR' ? 'Anand Murthy' : 'Dr. Ramesh Kumar',
      email: role === 'COLLECTOR' ? 'collector@walkerpass.gov.in' : 'admin@walkerpass.gov.in',
      role: role,
      gate: gate,
    };
    saveSession(demoUser);
  };

  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {
      // ignore
    }
    setUser(null);
    setToken(null);
    setPendingUser(null);
    router.push('/login');
  };

  const setGate = (newGate: string) => {
    if (!user) return;
    const updated = { ...user, gate: newGate };
    saveSession(updated, token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        verify2FA,
        quickDemoLogin,
        logout,
        setGate,
      }}
    >
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
