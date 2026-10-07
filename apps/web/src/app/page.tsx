'use client';

import React, { useState } from 'react';
import { AdminDashboard } from '../components/admin/admin-dashboard';
import { AppShell, UserRole } from '../components/layout/app-shell';
import { NetworkStatusBanner } from '../components/ui/network-status-banner';
import { CollectorHome, CollectorWalkerItem } from '../components/collector/collector-home';
import { CollectorRegistrationWizard } from '../components/collector/collector-registration-wizard';
import { CollectorWalkerProfile } from '../components/collector/collector-walker-profile';

export default function HomePage() {
  const [activeRole, setActiveRole] = useState<UserRole>('ADMIN');
  const [activeGate, setActiveGate] = useState('G2');

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

  return (
    <AppShell
      activeRole={activeRole}
      onRoleChange={setActiveRole}
      activeGate={activeGate}
      onGateChange={setActiveGate}
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
