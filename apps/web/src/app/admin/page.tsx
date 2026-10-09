'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { CollectorLogin } from '../../components/collector/collector-login';
import { AppShell, UserRole } from '../../components/layout/app-shell';
import { AdminDashboard } from '../../components/admin/admin-dashboard';
import { NetworkStatusBanner } from '../../components/ui/network-status-banner';
import { TreePine, Loader2 } from 'lucide-react';

export default function AdminPage() {
  const { user, isAuthenticated, isLoading, setGate } = useAuth();
  const [activeRole, setActiveRole] = useState<UserRole>('ADMIN');
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
          Loading Admin Portal...
        </div>
      </div>
    );
  }

  // Require login before opening Admin Dashboard
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-neutral-950 flex flex-col items-center justify-center p-4">
        <CollectorLogin
          defaultRole="ADMIN"
          selectedGate={activeGate}
          onLoginSuccess={(loggedUser) => {
            setActiveRole(loggedUser.role === 'COLLECTOR' ? 'COLLECTOR' : 'ADMIN');
            setActiveGate(loggedUser.gate);
          }}
        />
      </div>
    );
  }

  return (
    <AppShell
      activeRole={activeRole}
      onRoleChange={setActiveRole}
      activeGate={activeGate}
      onGateChange={(g) => {
        setActiveGate(g);
        setGate(g);
      }}
    >
      <NetworkStatusBanner />
      <div className="max-w-7xl mx-auto">
        <AdminDashboard currentUserRole={activeRole} />
      </div>
    </AppShell>
  );
}
