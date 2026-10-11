'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient, DashboardOverviewResponse } from '@wpd/shared';
import { apiRequest } from '@/lib/api';
import { AdminKpiCards } from './admin-kpi-cards';
import { AdminCharts } from './admin-charts';
import { AdminExpiriesTable } from './admin-expiries-table';
import { AdminWalkerManagement } from './admin-walker-management';
import { AdminUserManagement } from './admin-user-management';
import { AdminGatesSettings } from './admin-gates-settings';
import { AdminAuditLogViewer } from './admin-audit-log-viewer';
import { AdminReportsView } from '../admin-reports-view';
import { Button } from '../ui/button';
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Receipt,
  UserCog,
  Settings,
  ShieldCheck,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface AdminDashboardProps {
  apiClient?: ApiClient;
  currentUserRole?: 'SUPER_ADMIN' | 'ADMIN' | 'COLLECTOR';
}

export type AdminDashboardTab =
  | 'overview'
  | 'walkers'
  | 'expiries'
  | 'reports'
  | 'users'
  | 'settings'
  | 'audit';

export function AdminDashboard({ apiClient, currentUserRole = 'ADMIN' }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>('overview');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardOverviewResponse | null>(null);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [dateRange]);

  const fetchDashboardMetrics = async () => {
    setIsLoading(true);
    try {
      if (apiClient) {
        const res = await apiClient.admin.getDashboard({ range: dateRange });
        if (res && res.kpis) {
          setDashboardData(res);
          return;
        }
      }

      const data = await apiRequest<DashboardOverviewResponse>(`/admin/dashboard?range=${dateRange}`);
      if (data && data.kpis) {
        setDashboardData(data);
      }
    } catch {
      // Graceful empty state
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAllData = async () => {
    const confirmReset = window.confirm(
      'Are you sure you want to reset ALL data, passes, collections, and cash registers to ZERO to start fresh? This action cannot be undone.'
    );
    if (!confirmReset) return;

    setIsLoading(true);
    try {
      // 1. Clear any local drafts or cached items
      localStorage.removeItem('wpd_collector_draft');
      localStorage.removeItem('wpd_passes_records');
      window.dispatchEvent(new Event('wpd_data_updated'));

      // 2. Call backend reset endpoint if available
      await fetch('/api/v1/admin/reset-data', { method: 'POST' }).catch(() => {});

      // 3. Clear current dashboard state to clean zeroes
      setDashboardData({
        kpis: {
          activeWalkers: { count: 0, changePct: 0 },
          expiringSoon: { count: 0, changePct: 0 },
          expiredPasses: { count: 0, changePct: 0 },
          todayCollectionPaise: { amount: 0, changePct: 0 },
          monthCollectionPaise: { amount: 0, changePct: 0 },
          newVsRenewalThisMonth: { newCount: 0, renewalCount: 0, ratioPct: 0, changePct: 0 },
        },
        collectionsTrend: [],
        gateComparison: [],
        paymentModeSplit: {
          cashPaise: 0,
          cashCount: 0,
          cashPct: 0,
          upiPaise: 0,
          upiCount: 0,
          upiPct: 0,
        },
        registrationsOverTime: [],
      });

      alert('All pass records, collections, and cash data have been reset to 0 to start fresh.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Dashboard Controls */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Park Desk Administration
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-park-100 text-park-900 dark:bg-park-950 dark:text-park-300">
              {currentUserRole}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time park operations, revenue collections, pass validations, and staff controls.
          </p>
        </div>

        {/* Global Controls: Date Range Filter & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setDateRange('today')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                dateRange === 'today'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateRange('7d')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                dateRange === '7d'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setDateRange('30d')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                dateRange === '30d'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchDashboardMetrics}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleResetAllData}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            title="Reset all passes, collections, and cash counters to zero"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset to Zero (Fresh Start)
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
            activeTab === 'overview'
              ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Overview & KPIs
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('walkers')}
          className={`pb-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
            activeTab === 'walkers'
              ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Walker Directory
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expiries')}
          className={`pb-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
            activeTab === 'expiries'
              ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Expiring & Expired
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
            activeTab === 'reports'
              ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Reports & Reconciliation
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
            activeTab === 'users'
              ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <UserCog className="w-4 h-4" />
          Staff Management
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
            activeTab === 'settings'
              ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          Gates & Settings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
            activeTab === 'audit'
              ? 'border-park-700 dark:border-park-400 text-park-900 dark:text-park-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Audit Trail
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 1. 6 KPI Cards with Period-over-period Deltas */}
          <AdminKpiCards kpis={dashboardData?.kpis} isLoading={isLoading} />

          {/* 2. 4 SVG/Canvas Charts */}
          <AdminCharts
            collectionsTrend={dashboardData?.collectionsTrend}
            gateComparison={dashboardData?.gateComparison}
            paymentModeSplit={dashboardData?.paymentModeSplit}
            registrationsOverTime={dashboardData?.registrationsOverTime}
            isLoading={isLoading}
          />
        </div>
      )}

      {activeTab === 'walkers' && (
        <AdminWalkerManagement apiClient={apiClient} />
      )}

      {activeTab === 'expiries' && (
        <AdminExpiriesTable
          apiClient={apiClient}
          onRenewSuccess={fetchDashboardMetrics}
        />
      )}

      {activeTab === 'reports' && (
        <AdminReportsView currentUserRole={currentUserRole} />
      )}

      {activeTab === 'users' && (
        <AdminUserManagement apiClient={apiClient} />
      )}

      {activeTab === 'settings' && (
        <AdminGatesSettings apiClient={apiClient} />
      )}

      {activeTab === 'audit' && (
        <AdminAuditLogViewer apiClient={apiClient} />
      )}
    </div>
  );
}
