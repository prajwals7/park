'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Input, FormItem } from '../ui/form-controls';
import { useToast } from '../ui/toast';
import { useAuth } from '../../context/auth-context';
import { GATES } from '@wpd/shared';
import {
  Lock,
  TreePine,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  User,
  Shield,
  Eye,
  EyeOff,
  IdCard,
} from 'lucide-react';

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
  const { login, registerCollector, verify2FA } = useAuth();

  // Mode: 'LOGIN' vs 'SIGNUP'
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [activeTab, setActiveTab] = useState<'COLLECTOR' | 'ADMIN'>(defaultRole);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [gate, setGate] = useState(selectedGate);

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (newTab: 'COLLECTOR' | 'ADMIN') => {
    setActiveTab(newTab);
    setError(null);
    setEmail('');
    setPassword('');
  };

  const handleModeSwitch = (mode: 'LOGIN' | 'SIGNUP') => {
    setAuthMode(mode);
    setError(null);
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (authMode === 'SIGNUP') {
        if (!name.trim()) {
          setError('Please enter your full name');
          setIsLoading(false);
          return;
        }
        if (!gate) {
          setError('Please select an entry gate');
          setIsLoading(false);
          return;
        }

        const regResult = await registerCollector({
          name: name.trim(),
          email: email.trim(),
          password,
          gate,
          phone: phone.trim() || undefined,
        });

        if (!regResult.success) {
          setError(regResult.error || 'Failed to sign up collector');
          return;
        }

        toast({
          type: 'success',
          title: 'Collector Account Created',
          message: `Welcome, ${name.trim()}! Assigned to Gate ${gate}.`,
        });

        if (onLoginSuccess) {
          onLoginSuccess({
            id: 'collector-registered',
            name: name.trim(),
            role: 'COLLECTOR',
            gate,
          });
        } else {
          router.push('/collector');
        }
        return;
      }

      // LOGIN MODE
      const result = await login({ email: email.trim(), password, gate });
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
        message: `Welcome back to ${activeTab === 'COLLECTOR' ? 'Gate Desk' : 'Admin Portal'}!`,
      });

      const role = activeTab;
      if (onLoginSuccess) {
        onLoginSuccess({
          id: 'user-active',
          name: activeTab === 'COLLECTOR' ? 'Gate Collector' : 'Administrator',
          role: role,
          gate,
        });
      } else {
        router.push(role === 'COLLECTOR' ? '/collector' : '/admin');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
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
          name: activeTab === 'COLLECTOR' ? 'Gate Collector' : 'Administrator',
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

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
      {/* Top Ambient Glow Pill */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500 rounded-full" />

      {/* Brand Icon & Seal Header */}
      <div className="text-center space-y-2.5">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-700 via-park-900 to-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg border border-emerald-500/30 relative">
          <TreePine className="w-9 h-9 text-emerald-300 drop-shadow-sm" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs">
            ✓
          </div>
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 mb-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Govt. of Karnataka • Dept. of Horticulture
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Walker Pass Desk
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Lalbagh Botanical Garden Automated Ticketing
          </p>
        </div>
      </div>

      {/* Role Toggle Tabs (Collector vs Supervisor / Admin) */}
      <div className="grid grid-cols-2 p-1.5 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
        <button
          type="button"
          onClick={() => handleTabChange('COLLECTOR')}
          className={`py-2.5 text-xs font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'COLLECTOR'
              ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-md ring-1 ring-black/5 dark:ring-white/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <IdCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Gate Collector</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('ADMIN')}
          className={`py-2.5 text-xs font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'ADMIN'
              ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-md ring-1 ring-black/5 dark:ring-white/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Supervisor Admin</span>
        </button>
      </div>

      {/* Mode Toggle for Collectors: Existing vs First-time */}
      {activeTab === 'COLLECTOR' && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => handleModeSwitch('LOGIN')}
            className={`flex-1 pb-2.5 text-center transition border-b-2 ${
              authMode === 'LOGIN'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Authorized Collector Login
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('SIGNUP')}
            className={`flex-1 pb-2.5 text-center transition border-b-2 ${
              authMode === 'SIGNUP'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Register / First Time Desk
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold animate-in fade-in"
        >
          {error}
        </div>
      )}

      {!requires2FA ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SIGNUP: Name & Gate */}
          {activeTab === 'COLLECTOR' && authMode === 'SIGNUP' && (
            <>
              <FormItem label="Collector Full Name" required>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                  <Input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="pl-9 h-11 text-sm rounded-xl"
                  />
                </div>
              </FormItem>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Assigned Entry Gate Counter *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GATES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGate(g)}
                      className={`py-2 px-2 rounded-xl border text-sm font-bold transition flex flex-col items-center justify-center gap-0.5 ${
                        gate === g
                          ? 'bg-park-100 dark:bg-park-950 border-park-700 dark:border-park-400 text-park-900 dark:text-park-200 ring-2 ring-park-700/20 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-normal">Gate</span>
                      <span className="text-sm font-black">{g}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Identifier Input: Supports Collector ID (e.g. COL-G2-01), Email, or Phone */}
          <FormItem
            label={
              activeTab === 'COLLECTOR'
                ? 'Collector ID, Email, or Phone Number'
                : 'Admin Official Email'
            }
            required
            hint={
              activeTab === 'COLLECTOR'
                ? 'Enter your issued Collector ID (e.g. COL-G2-104), official email, or registered phone'
                : undefined
            }
          >
            <div className="relative">
              <IdCard className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <Input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  activeTab === 'COLLECTOR'
                    ? 'e.g. COL-G2-1049 or collector@park.gov.in'
                    : 'admin@walkerpass.gov.in'
                }
                className="pl-9 h-11 text-sm rounded-xl font-medium"
              />
            </div>
          </FormItem>

          {/* Password with Eye Toggle */}
          <FormItem label="Password" required>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="pl-9 pr-10 h-11 text-sm rounded-xl font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="w-8 h-8 absolute right-2 top-1.5 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormItem>

          {/* Sign In Submit Button */}
          <Button
            type="submit"
            isLoading={isLoading}
            className={`w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${
              activeTab === 'COLLECTOR'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            <span>
              {authMode === 'SIGNUP'
                ? 'Register Collector Desk'
                : activeTab === 'COLLECTOR'
                  ? 'Sign In to Gate Counter'
                  : 'Access Supervisor Portal'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      ) : (
        /* 2FA Verification View */
        <form onSubmit={handle2FAVerify} className="space-y-4 animate-in fade-in">
          <div className="p-3 bg-park-50 dark:bg-park-950/60 border border-park-200 dark:border-park-800 rounded-xl text-xs space-y-1">
            <div className="font-bold text-park-900 dark:text-park-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-park-700 dark:text-park-400" />
              <span>Two-Factor Authentication Required</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Enter the 6-digit verification code from your authenticator application.
            </p>
          </div>

          <FormItem label="6-Digit TOTP Code" required>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <Input
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="pl-9 h-11 tracking-widest text-center text-lg font-mono font-bold rounded-xl"
              />
            </div>
          </FormItem>

          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full h-12 rounded-2xl font-bold bg-park-800 hover:bg-park-700 text-white shadow-md active:scale-95"
          >
            Verify & Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      )}

      {/* Security & Verification Footer */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>256-Bit Encrypted Gate Terminal • Verhoeff Verified</span>
        </div>
      </div>
    </div>
  );
}
