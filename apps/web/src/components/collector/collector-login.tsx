'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Input, FormItem } from '../ui/form-controls';
import { useToast } from '../ui/toast';
import { useAuth } from '../../context/auth-context';
import { GATES } from '@wpd/shared';
import { Lock, TreePine, KeyRound, ArrowRight, ShieldCheck, User, Sparkles, Shield } from 'lucide-react';

export interface CollectorLoginProps {
  onLoginSuccess?: (user: {
    id: string;
    name: string;
    role: 'COLLECTOR' | 'ADMIN' | 'SUPER_ADMIN';
    gate: string;
  }) => void;
  selectedGate?: string;
  defaultRole?: 'COLLECTOR' | 'ADMIN';
}

export function CollectorLogin({
  onLoginSuccess,
  selectedGate = 'G2',
  defaultRole = 'COLLECTOR',
}: CollectorLoginProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { login, verify2FA, quickDemoLogin } = useAuth();

  const [activeTab, setActiveTab] = useState<'COLLECTOR' | 'ADMIN'>(defaultRole);
  const [email, setEmail] = useState('collector@walkerpass.gov.in');
  const [password, setPassword] = useState('Admin@12345');
  const [gate, setGate] = useState(selectedGate);
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (newTab: 'COLLECTOR' | 'ADMIN') => {
    setActiveTab(newTab);
    setError(null);
    if (newTab === 'COLLECTOR') {
      setEmail('collector@walkerpass.gov.in');
    } else {
      setEmail('admin@walkerpass.gov.in');
    }
  };

  const handleInitialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login({ email, password, gate });
      if (result.requires2FA) {
        setRequires2FA(true);
        toast({
          type: 'info',
          title: '2FA Verification Required',
          message: 'Please enter the 6-digit TOTP code from your authenticator app.',
        });
        return;
      }

      if (!result.success) {
        setError(result.error || 'Invalid credentials');
        return;
      }

      toast({
        type: 'success',
        title: 'Authentication Successful',
        message: `Welcome to Walker Pass Desk (${activeTab === 'COLLECTOR' ? `Gate ${gate}` : 'Admin Portal'})`,
      });

      const role = activeTab;
      if (onLoginSuccess) {
        onLoginSuccess({
          id: 'user-active',
          name: activeTab === 'COLLECTOR' ? 'Anand Murthy' : 'Sunita Rao',
          role: role,
          gate,
        });
      } else {
        router.push(role === 'COLLECTOR' ? '/collector' : '/admin');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await verify2FA(totpCode);
      if (!result.success) {
        setError(result.error || 'Invalid 2FA code');
        return;
      }

      toast({
        type: 'success',
        title: '2FA Verified',
        message: 'Session verified successfully.',
      });

      if (onLoginSuccess) {
        onLoginSuccess({
          id: 'user-verified',
          name: activeTab === 'COLLECTOR' ? 'Anand Murthy' : 'Sunita Rao',
          role: activeTab,
          gate,
        });
      } else {
        router.push(activeTab === 'COLLECTOR' ? '/collector' : '/admin');
      }
    } catch {
      setError('2FA verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOneTap = async (role: 'COLLECTOR' | 'ADMIN') => {
    setIsLoading(true);
    try {
      await quickDemoLogin(role, gate);
      toast({
        type: 'success',
        title: 'Demo Access Granted',
        message: `Signed in as ${role === 'COLLECTOR' ? 'Collector (Gate ' + gate + ')' : 'Admin'}`,
      });
      if (onLoginSuccess) {
        onLoginSuccess({
          id: role === 'COLLECTOR' ? 'collector-1' : 'admin-1',
          name: role === 'COLLECTOR' ? 'Anand Murthy' : 'Dr. Ramesh Kumar',
          role,
          gate,
        });
      } else {
        router.push(role === 'COLLECTOR' ? '/collector' : '/admin');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-5 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl space-y-6">
      {/* Brand Icon & Heading */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-park-900 dark:bg-park-700 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <TreePine className="w-8 h-8 text-emerald-300" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Walker Pass Desk
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Official Park Pass & Gate Ticketing Management
        </p>
      </div>

      {/* Role Toggle Tabs */}
      <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => handleTabChange('COLLECTOR')}
          className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
            activeTab === 'COLLECTOR'
              ? 'bg-white dark:bg-slate-900 text-park-900 dark:text-emerald-400 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Gate Collector
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('ADMIN')}
          className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
            activeTab === 'ADMIN'
              ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Supervisor / Admin
        </button>
      </div>

      {/* One-Tap Instant Access Bar */}
      <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-900 dark:text-emerald-300">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Quick Demo 1-Tap Access:
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleOneTap('COLLECTOR')}
            className="text-xs py-1.5 px-2 font-bold bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition shadow-2xs"
          >
            ⚡ Collector (Gate {gate})
          </button>
          <button
            type="button"
            onClick={() => handleOneTap('ADMIN')}
            className="text-xs py-1.5 px-2 font-bold bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/40 transition shadow-2xs"
          >
            ⚡ Admin Portal
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold"
        >
          {error}
        </div>
      )}

      {!requires2FA ? (
        <form onSubmit={handleInitialLogin} className="space-y-4">
          {/* Gate Selector for Collectors */}
          {activeTab === 'COLLECTOR' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Assigned Entry Gate *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GATES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGate(g)}
                    className={`py-2 px-2 rounded-xl border text-sm font-bold transition flex flex-col items-center justify-center gap-0.5 ${
                      gate === g
                        ? 'bg-park-50 dark:bg-park-950 border-park-700 dark:border-park-400 text-park-900 dark:text-park-200 ring-2 ring-park-700/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-[10px] opacity-75 font-normal">Gate</span>
                    <span className="text-sm font-extrabold">{g}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <FormItem label={activeTab === 'COLLECTOR' ? 'Collector Email' : 'Admin Email'} required>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={activeTab === 'COLLECTOR' ? 'collector@walkerpass.gov.in' : 'admin@walkerpass.gov.in'}
                className="pl-9 h-11 text-sm rounded-xl"
              />
            </div>
          </FormItem>

          <FormItem label="Password" required>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 h-11 text-sm rounded-xl"
              />
            </div>
          </FormItem>

          <Button
            type="submit"
            size="lg"
            variant="primary"
            isLoading={isLoading}
            className="w-full h-12 text-base font-bold rounded-xl mt-2 flex items-center justify-center gap-2"
          >
            {activeTab === 'COLLECTOR' ? `Sign In to Gate ${gate}` : 'Sign In to Admin Portal'}{' '}
            <ArrowRight className="w-4 h-4" />
          </Button>

          <div className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Session protected with Argon2id & AES-256 envelope encryption
          </div>
        </form>
      ) : (
        <form onSubmit={handle2FAVerify} className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-200">
            <strong>2FA Authentication Required:</strong> Enter the 6-digit TOTP verification code from your authenticator app.
          </div>

          <FormItem label="6-Digit Authenticator Code" required>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                type="text"
                autoFocus
                required
                maxLength={8}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.trim())}
                placeholder="000 000"
                className="pl-9 h-11 text-base tracking-widest font-mono font-bold rounded-xl text-center"
              />
            </div>
          </FormItem>

          <Button
            type="submit"
            size="lg"
            variant="primary"
            isLoading={isLoading}
            className="w-full h-12 text-base font-bold rounded-xl"
          >
            Verify & Unlock
          </Button>

          <button
            type="button"
            onClick={() => setRequires2FA(false)}
            className="w-full text-xs text-slate-500 hover:text-slate-800 text-center"
          >
            Back to credentials
          </button>
        </form>
      )}
    </div>
  );
}
