'use client';

import React from 'react';
import { DashboardKpis, formatPaiseToInr } from '@wpd/shared';
import {
  Users,
  AlertTriangle,
  Clock,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Repeat,
} from 'lucide-react';

interface AdminKpiCardsProps {
  kpis?: DashboardKpis;
  isLoading?: boolean;
}

export function AdminKpiCards({ kpis, isLoading }: AdminKpiCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse space-y-3"
          >
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-7 w-20 bg-slate-300 dark:bg-slate-600 rounded" />
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Fallback defaults if kpis not provided yet
  const activeCount = kpis?.activeWalkers.count ?? 120;
  const activeChange = kpis?.activeWalkers.changePct ?? 12;

  const expiringCount = kpis?.expiringSoon.count ?? 14;
  const expiringChange = kpis?.expiringSoon.changePct ?? -5;

  const expiredCount = kpis?.expiredPasses.count ?? 8;
  const expiredChange = kpis?.expiredPasses.changePct ?? 0;

  const todayPaise = kpis?.todayCollectionPaise.amount ?? 34000;
  const todayChange = kpis?.todayCollectionPaise.changePct ?? 8;

  const monthPaise = kpis?.monthCollectionPaise.amount ?? 482000;
  const monthChange = kpis?.monthCollectionPaise.changePct ?? 15;

  const newCount = kpis?.newVsRenewalThisMonth.newCount ?? 18;
  const renewalCount = kpis?.newVsRenewalThisMonth.renewalCount ?? 12;
  const newRatio = kpis?.newVsRenewalThisMonth.ratioPct ?? 60;

  const renderDelta = (pct: number) => {
    if (pct === 0) {
      return (
        <span className="inline-flex items-center text-[11px] font-semibold text-slate-500">
          0% vs prev period
        </span>
      );
    }
    const isPositive = pct > 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
          isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        }`}
      >
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? `+${pct}%` : `${pct}%`} vs prev
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* 1. Active Walkers */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-[11px] font-bold uppercase tracking-wider">Active Passes</span>
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">
          {activeCount}
        </div>
        <div className="mt-1">{renderDelta(activeChange)}</div>
      </div>

      {/* 2. Expiring in 7 Days */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-xs hover:border-amber-300 transition">
        <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
          <span className="text-[11px] font-bold uppercase tracking-wider">Expiring (7d)</span>
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-amber-900 dark:text-amber-200 mt-2">
          {expiringCount}
        </div>
        <div className="mt-1 flex items-center justify-between">
          {renderDelta(expiringChange)}
        </div>
      </div>

      {/* 3. Expired Passes */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-xs hover:border-rose-300 transition">
        <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
          <span className="text-[11px] font-bold uppercase tracking-wider">Expired Passes</span>
          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-rose-900 dark:text-rose-200 mt-2">
          {expiredCount}
        </div>
        <div className="mt-1">{renderDelta(expiredChange)}</div>
      </div>

      {/* 4. Today's Collections */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-[11px] font-bold uppercase tracking-wider">Today's Collection</span>
          <div className="p-1.5 rounded-lg bg-park-50 dark:bg-park-950/50 text-park-700 dark:text-park-400">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-park-900 dark:text-park-200 mt-2">
          {formatPaiseToInr(todayPaise)}
        </div>
        <div className="mt-1">{renderDelta(todayChange)}</div>
      </div>

      {/* 5. Month's Collections */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-[11px] font-bold uppercase tracking-wider">Month Collection</span>
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">
          {formatPaiseToInr(monthPaise)}
        </div>
        <div className="mt-1">{renderDelta(monthChange)}</div>
      </div>

      {/* 6. New vs Renewal this month */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-[11px] font-bold uppercase tracking-wider">New vs Renewal</span>
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400">
            <Repeat className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">
          {newRatio}% <span className="text-xs font-normal text-slate-500">New</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>{newCount} New</span>
          <span>•</span>
          <span>{renewalCount} Renewed</span>
        </div>
      </div>
    </div>
  );
}
