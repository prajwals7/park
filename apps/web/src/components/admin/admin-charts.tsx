'use client';

import React from 'react';
import {
  CollectionTrendItem,
  GateComparisonItem,
  PaymentModeSplit,
  RegistrationTrendItem,
  formatPaiseToInr,
} from '@wpd/shared';
import { BarChart3, PieChart, Layers, TrendingUp, Inbox } from 'lucide-react';

interface AdminChartsProps {
  collectionsTrend?: CollectionTrendItem[];
  gateComparison?: GateComparisonItem[];
  paymentModeSplit?: PaymentModeSplit;
  registrationsOverTime?: RegistrationTrendItem[];
  isLoading?: boolean;
}

export function AdminCharts({
  collectionsTrend = [],
  gateComparison = [],
  paymentModeSplit,
  registrationsOverTime = [],
  isLoading,
}: AdminChartsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse h-72"
          />
        ))}
      </div>
    );
  }

  const trendData: CollectionTrendItem[] = collectionsTrend;
  const gatesData: GateComparisonItem[] = gateComparison;
  const splitData: PaymentModeSplit = paymentModeSplit ?? {
    cashPaise: 0,
    cashCount: 0,
    cashPct: 0,
    upiPaise: 0,
    upiCount: 0,
    upiPct: 0,
  };
  const regData: RegistrationTrendItem[] = registrationsOverTime;

  // Maximum value for collections trend scaling
  const maxTrendPaise = Math.max(...trendData.map((d) => d.totalPaise), 100000);
  const maxGatePaise = Math.max(...gatesData.map((g) => g.totalPaise), 100000);
  const maxRegCount = Math.max(...regData.map((r) => r.registrations + r.renewals), 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Collections Trend (Daily / Periodic) */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-park-50 dark:bg-park-950/60 text-park-700 dark:text-park-300">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Collections Trend
                </h3>
                <p className="text-xs text-slate-500">Daily revenue breakdown (Cash vs UPI)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" /> Cash
              </span>
              <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" /> UPI
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          {trendData.length > 0 ? (
            <div className="mt-6 h-48 flex items-end gap-2 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
              {trendData.map((item, idx) => {
                const cashHeight = (item.cashPaise / maxTrendPaise) * 100;
                const upiHeight = (item.upiPaise / maxTrendPaise) * 100;
                const totalInr = formatPaiseToInr(item.totalPaise);

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-md">
                      {item.date}: {totalInr} ({item.count} passes)
                    </div>

                    <div className="w-full max-w-[28px] flex flex-col rounded-t overflow-hidden">
                      <div
                        style={{ height: `${Math.max(4, upiHeight * 1.4)}px` }}
                        className="bg-indigo-500 hover:bg-indigo-600 transition"
                        title={`UPI: ${formatPaiseToInr(item.upiPaise)}`}
                      />
                      <div
                        style={{ height: `${Math.max(4, cashHeight * 1.4)}px` }}
                        className="bg-emerald-600 hover:bg-emerald-700 transition"
                        title={`Cash: ${formatPaiseToInr(item.cashPaise)}`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 truncate max-w-full">
                      {item.date.slice(5) || item.date}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <Inbox className="w-7 h-7 stroke-1 text-slate-300 dark:text-slate-600" />
              <span>No collections recorded for this period</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Formula: Cash + UPI daily totals</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Total:{' '}
            {formatPaiseToInr(trendData.reduce((acc, curr) => acc + curr.totalPaise, 0))}
          </span>
        </div>
      </div>

      {/* 2. Gate Comparison */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Gate Performance
              </h3>
              <p className="text-xs text-slate-500">Total collection & passes per gate</p>
            </div>
          </div>

          {gatesData.length > 0 ? (
            <div className="mt-6 space-y-3.5">
              {gatesData.map((gate) => {
                const pct = maxGatePaise > 0 ? Math.round((gate.totalPaise / maxGatePaise) * 100) : 0;
                return (
                  <div key={gate.gateCode} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {gate.gateCode} • {gate.gateName}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatPaiseToInr(gate.totalPaise)} ({gate.paymentsCount} passes)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.max(4, pct)}%` }}
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <Inbox className="w-7 h-7 stroke-1 text-slate-300 dark:text-slate-600" />
              <span>No gate collections recorded yet</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Active Gates: G2, GS, G9</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Pass Count: {gatesData.reduce((acc, curr) => acc + curr.paymentsCount, 0)}
          </span>
        </div>
      </div>

      {/* 3. Cash vs UPI Split */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Cash vs UPI Split
              </h3>
              <p className="text-xs text-slate-500">Gate payment mode distribution</p>
            </div>
          </div>

          {splitData.cashCount > 0 || splitData.upiCount > 0 ? (
            <div className="mt-6 flex flex-col gap-4">
              <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${splitData.cashPct}%` }}
                  className="h-full bg-emerald-600 transition-all duration-300"
                  title={`Cash: ${splitData.cashPct}%`}
                />
                <div
                  style={{ width: `${splitData.upiPct}%` }}
                  className="h-full bg-indigo-600 transition-all duration-300"
                  title={`UPI: ${splitData.upiPct}%`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                    Cash Payments
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {formatPaiseToInr(splitData.cashPaise)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {splitData.cashCount} receipts ({splitData.cashPct}%)
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase">
                    UPI Payments
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {formatPaiseToInr(splitData.upiPaise)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {splitData.upiCount} receipts ({splitData.upiPct}%)
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <Inbox className="w-7 h-7 stroke-1 text-slate-300 dark:text-slate-600" />
              <span>No payments recorded</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Information & audit reporting only</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Total Slips: {splitData.cashCount + splitData.upiCount}
          </span>
        </div>
      </div>

      {/* 4. Registrations Over Time (New vs Renewal) */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Registrations vs Renewals
                </h3>
                <p className="text-xs text-slate-500">New walker inflow vs recurring renewals</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" /> New
              </span>
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> Renewal
              </span>
            </div>
          </div>

          {regData.length > 0 ? (
            <div className="mt-6 h-48 flex items-end gap-2 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
              {regData.map((item, idx) => {
                const newHeight = (item.registrations / maxRegCount) * 100;
                const renewHeight = (item.renewals / maxRegCount) * 100;
                const totalCount = item.registrations + item.renewals;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-md">
                      {item.date}: {item.registrations} New, {item.renewals} Renewal
                    </div>

                    <div className="w-full max-w-[28px] flex flex-col rounded-t overflow-hidden">
                      <div
                        style={{ height: `${Math.max(4, renewHeight * 1.4)}px` }}
                        className="bg-amber-500 hover:bg-amber-600 transition"
                      />
                      <div
                        style={{ height: `${Math.max(4, newHeight * 1.4)}px` }}
                        className="bg-emerald-600 hover:bg-emerald-700 transition"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 truncate max-w-full">
                      {item.date.slice(5) || item.date}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <Inbox className="w-7 h-7 stroke-1 text-slate-300 dark:text-slate-600" />
              <span>No registrations or renewals recorded yet</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Inflow breakdown</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Total:{' '}
            {regData.reduce((acc, curr) => acc + curr.registrations + curr.renewals, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
