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

interface PendingChallenge {
  challengeToken: string;
  user: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string; gate?: string }) => Promise<{ success: boolean; error?: string; requires2FA?: boolean }>;
  registerCollector: (data: { name: string; email: string; password: string; gate: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  verify2FA: (totpCode: string) => Promise<{ success: boolean; error?: string }>;
  quickDemoLogin: (role: 'COLLECTOR' | 'ADMIN', gate?: string) => Promise<void>;
  logout: () => void;
  setGate: (gate: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'wpd_auth_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null);
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
        return { success: false, error: data.message || 'Invalid email or password' };
      }

      // Check for 2FA / TOTP Challenge
      if (data.requiresTotp || data.requires2FA) {
        const challengeToken = data.challengeToken || data.tempToken;
        const targetRole: 'ADMIN' | 'COLLECTOR' = credentials.email.toLowerCase().includes('collector') ? 'COLLECTOR' : 'ADMIN';
        setPendingChallenge({
          challengeToken,
          user: {
            id: data.user?.id || 'u-pending',
            name: data.user?.name || (targetRole === 'ADMIN' ? 'Sunita Rao' : 'Gate Collector'),
            email: credentials.email,
            role: targetRole,
            gate: selectedGate,
          },
        });
        return { success: false, requires2FA: true };
      }

      const loggedUser: AuthUser = {
        id: data.user?.id || 'u-active',
        name: data.user?.name || (credentials.email.includes('collector') ? 'Anand Murthy' : 'Sunita Rao'),
        email: data.user?.email || credentials.email,
        role: data.user?.role || (credentials.email.includes('collector') ? 'COLLECTOR' : 'ADMIN'),
        gate: selectedGate,
      };

      saveSession(loggedUser, data.accessToken || null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network connection failed' };
    }
  };

  const registerCollector = async (data: {
    name: string;
    email: string;
    password: string;
    gate: string;
    phone?: string;
  }) => {
    try {
      const res = await fetch('/api/v1/auth/register-collector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          gate: data.gate,
          phone: data.phone || '',
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: resData.message || (Array.isArray(resData.details) ? resData.details[0]?.message : 'Registration failed'),
        };
      }

      const newUser: AuthUser = {
        id: resData.user?.id || 'u-collector',
        name: resData.user?.name || data.name,
        email: resData.user?.email || data.email,
        role: 'COLLECTOR',
        gate: data.gate || 'G2',
      };

      saveSession(newUser, resData.accessToken || null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network connection failed' };
    }
  };

  const verify2FA = async (totpCode: string) => {
    if (!pendingChallenge) {
      return { success: false, error: 'No 2FA verification in progress' };
    }
    try {
      const res = await fetch('/api/v1/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode, challengeToken: pendingChallenge.challengeToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || 'Invalid 2FA code' };
      }
      const confirmedUser: AuthUser = {
        ...pendingChallenge.user,
        id: data.user?.id || pendingChallenge.user.id,
        name: data.user?.name || pendingChallenge.user.name,
        role: data.user?.role || pendingChallenge.user.role,
      };
      saveSession(confirmedUser, data.accessToken || null);
      setPendingChallenge(null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '2FA verification failed' };
    }
  };

  const quickDemoLogin = async (role: 'COLLECTOR' | 'ADMIN', gate: string = 'G2') => {
    const email = role === 'COLLECTOR' ? 'collector@walkerpass.gov.in' : 'admin@walkerpass.gov.in';
    const password = 'Admin@12345';

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.requiresTotp && data.challengeToken) {
          // In development mode, verify with 123456 immediately
          const vRes = await fetch('/api/v1/auth/verify-2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: '123456', challengeToken: data.challengeToken }),
          });
          if (vRes.ok) {
            const vData = await vRes.json();
            const demoUser: AuthUser = {
              id: vData.user?.id || 'admin-1',
              name: vData.user?.name || 'Dr. Ramesh Kumar',
              email,
              role: 'ADMIN',
              gate,
            };
            saveSession(demoUser, vData.accessToken);
            return;
          }
        } else if (data.accessToken) {
          const demoUser: AuthUser = {
            id: data.user?.id || 'collector-1',
            name: data.user?.name || 'Anand Murthy',
            email,
            role: 'COLLECTOR',
            gate,
          };
          saveSession(demoUser, data.accessToken);
          return;
        }
      }
    } catch {
      // offline fallback
    }

    // Fallback if backend unreachable
    const fallbackUser: AuthUser = {
      id: role === 'COLLECTOR' ? 'collector-1' : 'admin-1',
      name: role === 'COLLECTOR' ? 'Anand Murthy' : 'Dr. Ramesh Kumar',
      email,
      role,
      gate,
    };
    saveSession(fallbackUser, null);
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
    setPendingChallenge(null);
    router.push('/');
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
        registerCollector,
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
