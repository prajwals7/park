'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GATES, PASS_CONFIG, formatPaiseToInr } from '@wpd/shared';
import { WalkerRegistrationForm } from '../components/walker-registration-form';
import { WalkerProfileCard, WalkerProfileData } from '../components/walker-profile-card';
import { AdminReportsView } from '../components/admin-reports-view';
import { AppShell, UserRole } from '../components/layout/app-shell';
import { NetworkStatusBanner } from '../components/ui/network-status-banner';
import { CollectorHome, CollectorWalkerItem } from '../components/collector/collector-home';
import { CollectorRegistrationWizard } from '../components/collector/collector-registration-wizard';
import { CollectorWalkerProfile } from '../components/collector/collector-walker-profile';
import { UserPlus, Users, Sparkles, BarChart3, Palette } from 'lucide-react';

const INITIAL_DEMO_WALKER: WalkerProfileData = {
  id: 'walker-demo-1',
  passNo: 'PASS-00101',
  name: 'Ananya Sharma',
  phone: '9845012345',
  gateId: 'G2',
  aadhaarLast4: '4511',
  maskedAadhaar: 'XXXX XXXX 4511',
  status: 'ACTIVE',
  expiryDate: '06 Nov 2026',
  latestPaymentId: 'pay-001',
  latestReceiptNo: 'RC-000101',
  latestPaymentMode: 'CASH',
};

export default function HomePage() {
  const [activeRole, setActiveRole] = useState<UserRole>('COLLECTOR');
  const [activeGate, setActiveGate] = useState('G2');

  // Admin View State
  const [activeAdminTab, setActiveAdminTab] = useState<'register' | 'profile' | 'reports'>(
    'register',
  );
  const [currentWalker, setCurrentWalker] = useState<WalkerProfileData>(INITIAL_DEMO_WALKER);

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
        /* ADMIN EXPERIENCE (Wide Sidebar Layout)                      */
        /* ============================================================ */
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Metric Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Standard Pass Tariff
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {formatPaiseToInr(PASS_CONFIG.PRICE_PAISE)}
              </div>
              <p className="text-xs text-slate-400 mt-1">30 days validity from issue date</p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Active Gates
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {GATES.join(', ')}
              </div>
              <p className="text-xs text-slate-400 mt-1">Operating entry points</p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Data Privacy & Security
              </div>
              <div className="text-base font-bold text-park-900 dark:text-park-300 mt-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-park-700 dark:text-park-400" />
                AES-256-GCM + Verhoeff
              </div>
              <p className="text-xs text-slate-400 mt-1">Zero plaintext Aadhaar storage</p>
            </div>

            <div className="p-4 bg-park-50/60 dark:bg-park-950/40 rounded-xl border border-park-200 dark:border-park-800/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase text-park-900 dark:text-park-300 tracking-wider flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-park-700 dark:text-park-400" />
                  Design System
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Component showcase & style tokens
                </p>
              </div>
              <Link
                href="/design"
                className="mt-2 text-xs font-bold text-park-800 dark:text-park-300 hover:underline inline-flex items-center gap-1"
              >
                Open /design page →
              </Link>
            </div>
          </div>

          {/* View Switcher Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveAdminTab('register')}
              className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                activeAdminTab === 'register'
                  ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              New Walker Registration
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab('profile')}
              className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                activeAdminTab === 'profile'
                  ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Walker Profile & Reveal Flow
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab('reports')}
              className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                activeAdminTab === 'reports'
                  ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Admin Reports & Collections
            </button>
          </div>

          {/* Admin Content */}
          {activeAdminTab === 'register' ? (
            <div className="max-w-3xl">
              <WalkerRegistrationForm
                onSuccess={(walker) => {
                  setCurrentWalker({
                    id: walker.id,
                    passNo: walker.passNo,
                    name: walker.name,
                    phone: '9845012345',
                    gateId: activeGate,
                    aadhaarLast4: '4511',
                    maskedAadhaar: 'XXXX XXXX 4511',
                    status: 'ACTIVE',
                    expiryDate: '30 Days from today',
                  });
                  setActiveAdminTab('profile');
                }}
              />
            </div>
          ) : activeAdminTab === 'profile' ? (
            <div className="max-w-xl">
              <WalkerProfileCard walker={currentWalker} currentUserRole="ADMIN" />
            </div>
          ) : (
            <div className="max-w-5xl">
              <AdminReportsView currentUserRole="ADMIN" />
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
