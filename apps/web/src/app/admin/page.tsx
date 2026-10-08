'use client';

import React, { useState } from 'react';
import { AppShell, UserRole } from '../../components/layout/app-shell';
import { AdminDashboard } from '../../components/admin/admin-dashboard';
import { NetworkStatusBanner } from '../../components/ui/network-status-banner';

export default function AdminPage() {
  const [activeRole, setActiveRole] = useState<UserRole>('ADMIN');
  const [activeGate, setActiveGate] = useState('G2');

  return (
    <AppShell
      activeRole={activeRole}
      onRoleChange={setActiveRole}
      activeGate={activeGate}
      onGateChange={setActiveGate}
    >
      <NetworkStatusBanner />
      <div className="max-w-7xl mx-auto">
        <AdminDashboard currentUserRole={activeRole} />
      </div>
    </AppShell>
  );
}
