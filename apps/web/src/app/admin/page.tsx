'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { CollectorLogin } from '../../components/collector/collector-login';
import { AppShell } from '../../components/layout/app-shell';
import { AdminDashboard } from '../../components/admin/admin-dashboard';
import { NetworkStatusBanner } from '../../components/ui/network-status-banner';
import { Button } from '../../components/ui/button';
import { TreePine, Loader2, ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';

export default function AdminPage() {
  const { user, isAuthenticated, isLoading, setGate, logout } = useAuth();
  const [activeGate, setActiveGate] = useState('G2');

  useEffect(() => {
    if (user?.gate) {
      setActiveGate(user.gate);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-600 flex items-center justify-center animate-pulse">
          <TreePine className="w-8 h-8 text-white" />
        </div>
        <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          Verifying Admin Authorization...
        </div>
      </div>
    );
  }

  // 1. Require login before opening Admin Dashboard
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-neutral-950 flex flex-col items-center justify-center p-4">
        <CollectorLogin
          defaultRole="ADMIN"
          selectedGate={activeGate}
          onLoginSuccess={(loggedUser) => {
            setActiveGate(loggedUser.gate);
          }}
        />
      </div>
    );
  }

  // 2. Strict Role Guard: ONLY ADMIN or SUPER_ADMIN can access Admin Dashboard
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="w-16 h-16 bg-red-950/70 border border-red-800 text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-white">Admin Access Restricted</h2>
            <p className="text-xs text-slate-400">
              The Admin Dashboard requires an Administrator or Supervisor account.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 text-xs text-left space-y-1">
            <div className="text-slate-400">Current Signed-in Account:</div>
            <div className="font-bold text-white flex items-center justify-between">
              <span>{user.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                {user.role}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <Link href="/collector" className="w-full">
              <Button variant="primary" size="md" className="w-full justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Go to Collector Gate Desk
              </Button>
            </Link>
            <Button
              variant="outline"
              size="md"
              className="w-full justify-center gap-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
              onClick={logout}
            >
              <LogIn className="w-4 h-4 text-amber-400" />
              Sign in with an Admin Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized Admin: Render Full Admin Dashboard
  return (
    <AppShell
      activeRole="ADMIN"
      onRoleChange={() => {}}
      activeGate={activeGate}
      onGateChange={(g) => {
        setActiveGate(g);
        setGate(g);
      }}
    >
      <NetworkStatusBanner />
      <div className="max-w-7xl mx-auto">
        <AdminDashboard currentUserRole={user.role as 'ADMIN' | 'SUPER_ADMIN'} />
      </div>
    </AppShell>
  );
}
