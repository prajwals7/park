'use client';

import React, { useState } from 'react';
import { GATES, PASS_CONFIG, formatPaiseToInr } from '@wpd/shared';
import { WalkerRegistrationForm } from '../components/walker-registration-form';
import { WalkerProfileCard, WalkerProfileData } from '../components/walker-profile-card';
import { AdminReportsView } from '../components/admin-reports-view';
import { ShieldCheck, UserPlus, Users, Sparkles, BarChart3 } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'register' | 'profile' | 'reports'>('register');
  const [currentWalker, setCurrentWalker] = useState<WalkerProfileData>(INITIAL_DEMO_WALKER);
  const [activeRole, setActiveRole] = useState<'ADMIN' | 'COLLECTOR'>('ADMIN');

  return (
    <main className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center shadow-sm">
              WP
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Walker Pass Desk</h1>
              <p className="text-xs text-slate-500">
                Government Walking Park • Ticketing & Pass Desk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Active User Role Switcher for Testing */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border text-xs">
              <span className="text-slate-500 px-1 font-medium">Role:</span>
              <button
                type="button"
                onClick={() => setActiveRole('ADMIN')}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  activeRole === 'ADMIN'
                    ? 'bg-white shadow-xs text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ADMIN
              </button>
              <button
                type="button"
                onClick={() => setActiveRole('COLLECTOR')}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  activeRole === 'COLLECTOR'
                    ? 'bg-white shadow-xs text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                COLLECTOR
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              AES-256-GCM Envelope Encryption
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 mt-8 space-y-6">
        {/* Metric Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              Standard Pass Tariff
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatPaiseToInr(PASS_CONFIG.PRICE_PAISE)}
            </div>
            <p className="text-xs text-slate-400 mt-1">30 days validity from issue date</p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              Active Gates
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{GATES.join(', ')}</div>
            <p className="text-xs text-slate-400 mt-1">Entry points: G2, GS, G9</p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              Data Privacy & Security
            </div>
            <div className="text-base font-bold text-indigo-900 mt-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Verhoeff Checksum + HMAC Index
            </div>
            <p className="text-xs text-slate-400 mt-1">Zero plaintext Aadhaar storage</p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'register'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            New Walker Registration
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Walker Profile & Reveal Flow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'reports'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Admin Reports & Collections
          </button>
        </div>

        {/* View Content */}
        {activeTab === 'register' ? (
          <div className="max-w-3xl">
            <WalkerRegistrationForm
              onSuccess={(walker) => {
                setCurrentWalker({
                  id: walker.id,
                  passNo: walker.passNo,
                  name: walker.name,
                  phone: '9845012345',
                  gateId: 'G2',
                  aadhaarLast4: '4511',
                  maskedAadhaar: 'XXXX XXXX 4511',
                  status: 'ACTIVE',
                  expiryDate: '30 Days from today',
                });
                setActiveTab('profile');
              }}
            />
          </div>
        ) : activeTab === 'profile' ? (
          <div className="max-w-xl">
            <WalkerProfileCard walker={currentWalker} currentUserRole={activeRole} />
          </div>
        ) : (
          <div className="max-w-5xl">
            <AdminReportsView currentUserRole={activeRole} />
          </div>
        )}
      </div>
    </main>
  );
}
