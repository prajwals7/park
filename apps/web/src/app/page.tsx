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
import { TreePine, Loader2, Banknote, QrCode, Printer, X } from 'lucide-react';
import { getGateShiftSummary, GateShiftSummary } from '@/lib/pass-store';

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

  // Collector Mobile View State ('home' | 'register' | 'profile' | 'shift')
  const [collectorView, setCollectorView] = useState<'home' | 'register' | 'profile' | 'shift'>('home');
  const [selectedCollectorWalker, setSelectedCollectorWalker] = useState<CollectorWalkerItem | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftSummary, setShiftSummary] = useState<GateShiftSummary | null>(null);

  // Refresh shift summary
  const refreshShiftData = () => {
    setShiftSummary(getGateShiftSummary(activeGate));
  };

  useEffect(() => {
    refreshShiftData();
    const handleUpdate = () => refreshShiftData();
    window.addEventListener('wpd_data_updated', handleUpdate);
    return () => window.removeEventListener('wpd_data_updated', handleUpdate);
  }, [activeGate]);

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

  const userIsCollector = user.role === 'COLLECTOR';

  // 3. Authenticated: Render Appropriate Protected Page / Dashboard
  return (
    <AppShell
      activeRole={userIsCollector ? 'COLLECTOR' : 'ADMIN'}
      onRoleChange={() => {}}
      activeGate={activeGate}
      onGateChange={(g) => {
        setActiveGate(g);
        setGate(g);
      }}
      collectorView={collectorView}
      onCollectorNavigate={(view) => {
        if (view === 'shift') {
          refreshShiftData();
          setIsShiftModalOpen(true);
        } else {
          setCollectorView(view);
        }
      }}
      onOpenShiftSummary={() => {
        refreshShiftData();
        setIsShiftModalOpen(true);
      }}
    >
      {/* Offline / Poor Network Banner with Safe Mode Indicator */}
      <NetworkStatusBanner />

      {/* ============================================================ */}
      {/* COLLECTOR EXPERIENCE (Mobile-First Gate Desk)                */}
      {/* ============================================================ */}
      {userIsCollector ? (
        <div className="space-y-6">
          {collectorView === 'home' && (
            <CollectorHome
              currentGate={activeGate}
              onStartRegistration={() => setCollectorView('register')}
              onSelectWalker={(w) => {
                setSelectedCollectorWalker(w);
                setCollectorView('profile');
              }}
              onOpenShift={() => {
                refreshShiftData();
                setIsShiftModalOpen(true);
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

          {collectorView === 'profile' && selectedCollectorWalker && (
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

      {/* ============================================================ */}
      {/* MOBILE SHIFT CASH & RECONCILIATION MODAL                     */}
      {/* ============================================================ */}
      {isShiftModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={() => setIsShiftModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-6 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Daily Shift Summary
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  Gate {activeGate} Register
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total Tariff Card */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                  Total Collected Today
                </span>
                <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-0.5">
                  ₹{shiftSummary?.totalRevenueInr?.toFixed(2) || '0.00'}
                </div>
              </div>
              <span className="text-xs font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2.5 py-1 rounded-full">
                {shiftSummary?.totalPassesToday || 0} Passes
              </span>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Banknote className="w-4 h-4" /> Cash in Hand
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  ₹{shiftSummary?.cashAmountInr?.toFixed(2) || '0.00'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {shiftSummary?.cashSlipsCount || 0} cash receipts
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                  <QrCode className="w-4 h-4" /> UPI QR Scans
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  ₹{shiftSummary?.upiAmountInr?.toFixed(2) || '0.00'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {shiftSummary?.upiSlipsCount || 0} digital payments
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Duty Collector:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{user?.name || 'Gate Collector'}</span>
              </div>
              <div className="flex justify-between">
                <span>Shift Status:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Active</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full h-12 bg-park-900 dark:bg-park-600 hover:bg-park-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" />
                Print / Share Shift Register
              </button>
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

