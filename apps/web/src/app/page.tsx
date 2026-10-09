'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { CollectorLogin } from '../components/collector/collector-login';
import { AdminDashboard } from '../components/admin/admin-dashboard';
import { AppShell, UserRole } from '../components/layout/app-shell';
import { NetworkStatusBanner } from '../components/ui/network-status-banner';
import { CollectorHome, CollectorWalkerItem } from '../components/collector/collector-home';
import { CollectorRegistrationWizard } from '../components/collector/collector-registration-wizard';
import { CollectorWalkerProfile } from '../components/collector/collector-walker-profile';
import { TreePine, Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, isAuthenticated, isLoading, setGate } = useAuth();

  const [activeRole, setActiveRole] = useState<UserRole>('ADMIN');
  const [activeGate, setActiveGate] = useState('G2');

  // Synchronize role and gate when authenticated user changes
  useEffect(() => {
    if (user) {
      if (user.role === 'COLLECTOR') {
        setActiveRole('COLLECTOR');
      } else {
        setActiveRole('ADMIN');
      }
      if (user.gate) {
        setActiveGate(user.gate);
      }
    }
  }, [user]);

  // Collector Mobile View State ('home' | 'register' | 'profile')
  const [collectorView, setCollectorView] = useState<'home' | 'register' | 'profile'>('home');
  const [selectedCollectorWalker, setSelectedCollectorWalker] = useState<CollectorWalkerItem>({
    id: 'w-1',
    passNo: 'WP-1001',
    name: 'Ananya Sharma',
    phone: '9845012345',
    gateId: 'G2',
    status: 'ACTIVE',
    expiryDate: '06 Nov 2026',
    daysRemaining: 29,
    latestReceiptNo: 'RC-000101',
    latestPaymentMode: 'CASH',
  });

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center animate-pulse">
          <TreePine className="w-8 h-8 text-white" />
        </div>
        <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          Initializing Walker Pass Desk...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: REQUIRE LOGIN FIRST BEFORE DASHBOARD OR HOME PAGE
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-neutral-950 flex flex-col items-center justify-center p-4">
        <CollectorLogin
          selectedGate={activeGate}
          onLoginSuccess={(loggedUser) => {
            setActiveRole(loggedUser.role === 'COLLECTOR' ? 'COLLECTOR' : 'ADMIN');
            setActiveGate(loggedUser.gate);
          }}
        />
      </div>
    );
  }

  // 3. Authenticated: Render Appropriate Protected Page / Dashboard
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
      {/* Offline / Poor Network Banner with Safe Mode Indicator */}
      <NetworkStatusBanner />

      {/* ============================================================ */}
      {/* COLLECTOR EXPERIENCE (Mobile-First Gate Desk)                */}
      {/* ============================================================ */}
      {activeRole === 'COLLECTOR' ? (
        <div className="space-y-6">
          {collectorView === 'home' && (
            <CollectorHome
              currentGate={activeGate}
              onStartRegistration={() => setCollectorView('register')}
              onSelectWalker={(w) => {
                setSelectedCollectorWalker(w);
                setCollectorView('profile');
              }}
            />
          )}

          {collectorView === 'register' && (
            <CollectorRegistrationWizard
              currentGate={activeGate}
              onCancel={() => setCollectorView('home')}
              onSuccess={(w) => {
                setSelectedCollectorWalker({
                  id: w.id,
                  passNo: w.passNo,
                  name: w.name,
                  phone: w.phone,
                  gateId: w.gateId,
                  status: 'ACTIVE',
                  expiryDate: '30 Days from today',
                  daysRemaining: 30,
                  latestReceiptNo: w.latestReceiptNo,
                  latestPaymentMode: w.latestPaymentMode,
                });
                setCollectorView('profile');
              }}
            />
          )}

          {collectorView === 'profile' && (
            <CollectorWalkerProfile
              walker={selectedCollectorWalker}
              onBack={() => setCollectorView('home')}
              onUpdateWalker={(upd) => setSelectedCollectorWalker(upd)}
            />
          )}
        </div>
      ) : (
        /* ============================================================ */
        /* ADMIN EXPERIENCE (Wide Sidebar Unified Dashboard)           */
        /* ============================================================ */
        <div className="max-w-7xl mx-auto">
          <AdminDashboard currentUserRole={activeRole} />
        </div>
      )}
    </AppShell>
  );
}
