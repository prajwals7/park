'use client';

import React from 'react';
import {
  CollectionTrendItem,
  GateComparisonItem,
  PaymentModeSplit,
  RegistrationTrendItem,
  formatPaiseToInr,
} from '@wpd/shared';
import { BarChart3, PieChart, TrendingUp, Layers } from 'lucide-react';

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

  // Fallback demo data if empty
  const trendData: CollectionTrendItem[] =
    collectionsTrend.length > 0
      ? collectionsTrend
      : [
          { date: '01 Oct', totalPaise: 40000, cashPaise: 24000, upiPaise: 16000, count: 2 },
          { date: '02 Oct', totalPaise: 60000, cashPaise: 38000, upiPaise: 22000, count: 3 },
          { date: '03 Oct', totalPaise: 48000, cashPaise: 28000, upiPaise: 20000, count: 2 },
          { date: '04 Oct', totalPaise: 82000, cashPaise: 42000, upiPaise: 40000, count: 4 },
          { date: '05 Oct', totalPaise: 74000, cashPaise: 34000, upiPaise: 40000, count: 4 },
          { date: '06 Oct', totalPaise: 96000, cashPaise: 56000, upiPaise: 40000, count: 5 },
          { date: '07 Oct', totalPaise: 110000, cashPaise: 68000, upiPaise: 42000, count: 6 },
        ];

  const gatesData: GateComparisonItem[] =
    gateComparison.length > 0
      ? gateComparison
      : [
          {
            gateCode: 'G2',
            gateName: 'North Gate',
            totalPaise: 240000,
            paymentsCount: 12,
            walkersCount: 65,
          },
          {
            gateCode: 'GS',
            gateName: 'South Gate',
            totalPaise: 160000,
            paymentsCount: 8,
            walkersCount: 42,
          },
          {
            gateCode: 'G9',
            gateName: 'East Gate',
            totalPaise: 100000,
            paymentsCount: 5,
            walkersCount: 23,
          },
        ];

  const splitData: PaymentModeSplit = paymentModeSplit ?? {
    cashPaise: 310000,
    cashCount: 15,
    cashPct: 62,
    upiPaise: 190000,
    upiCount: 10,
    upiPct: 38,
  };

  const regData: RegistrationTrendItem[] =
    registrationsOverTime.length > 0
      ? registrationsOverTime
      : [
          { date: '01 Oct', registrations: 2, renewals: 1 },
          { date: '02 Oct', registrations: 3, renewals: 2 },
          { date: '03 Oct', registrations: 1, renewals: 3 },
          { date: '04 Oct', registrations: 4, renewals: 2 },
          { date: '05 Oct', registrations: 3, renewals: 4 },
          { date: '06 Oct', registrations: 5, renewals: 3 },
          { date: '07 Oct', registrations: 4, renewals: 5 },
        ];

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
          <div className="mt-6 h-48 flex items-end gap-2 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
            {trendData.map((item, idx) => {
              const cashHeight = (item.cashPaise / maxTrendPaise) * 100;
              const upiHeight = (item.upiPaise / maxTrendPaise) * 100;
              const totalInr = formatPaiseToInr(item.totalPaise);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                  {/* Tooltip on hover */}
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
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2">
          <span>Total Recorded Range</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {formatPaiseToInr(trendData.reduce((acc, curr) => acc + curr.totalPaise, 0))}
          </span>
        </div>
      </div>

      {/* 2. Gate Comparison */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Gate Performance Comparison
              </h3>
              <p className="text-xs text-slate-500">Revenue & active passes per entrance gate</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {gatesData.map((gate) => {
              const widthPct = (gate.totalPaise / maxGatePaise) * 100;
              return (
                <div key={gate.gateCode} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Gate {gate.gateCode} ({gate.gateName})
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">
                      {formatPaiseToInr(gate.totalPaise)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${Math.max(6, widthPct)}%` }}
                      className="bg-park-600 rounded-full transition-all duration-500"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{gate.paymentsCount} transactions</span>
                    <span>{gate.walkersCount} active walkers</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
          <span>Active Operating Gates</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {gatesData.length} gates active
          </span>
        </div>
      </div>

      {/* 3. Cash vs UPI Split */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Payment Mode Split
              </h3>
              <p className="text-xs text-slate-500">Physically recorded Cash vs UPI ratio</p>
            </div>
          </div>

          {/* Segmented split bar */}
          <div className="mt-6 space-y-4">
            <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${splitData.cashPct}%` }}
                className="bg-emerald-600 transition-all duration-500"
                title={`Cash: ${splitData.cashPct}%`}
              />
              <div
                style={{ width: `${splitData.upiPct}%` }}
                className="bg-indigo-600 transition-all duration-500"
                title={`UPI: ${splitData.upiPct}%`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-3.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  Physical Cash ({splitData.cashPct}%)
                </div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  {formatPaiseToInr(splitData.cashPaise)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {splitData.cashCount} payments collected
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 dark:text-indigo-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                  UPI Reference ({splitData.upiPct}%)
                </div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  {formatPaiseToInr(splitData.upiPaise)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {splitData.upiCount} payments recorded
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-4 italic">
          Recorded for reconciliation & audit reporting only. No payment gateway involved.
        </p>
      </div>

      {/* 4. Registrations Over Time */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Registrations & Renewals
                </h3>
                <p className="text-xs text-slate-500">Volume trend over selected duration</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-sky-700 dark:text-sky-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" /> New
              </span>
              <span className="flex items-center gap-1 text-violet-700 dark:text-violet-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-violet-500 inline-block" /> Renew
              </span>
            </div>
          </div>

          {/* Activity Bar Chart */}
          <div className="mt-6 h-48 flex items-end gap-2 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
            {regData.map((item, idx) => {
              const newHeight = (item.registrations / maxRegCount) * 100;
              const renHeight = (item.renewals / maxRegCount) * 100;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-md">
                    {item.date}: {item.registrations} New, {item.renewals} Renewal
                  </div>

                  <div className="w-full max-w-[28px] flex items-end gap-1">
                    <div
                      style={{ height: `${Math.max(4, newHeight * 1.4)}px` }}
                      className="flex-1 bg-sky-500 hover:bg-sky-600 rounded-t transition"
                      title={`New: ${item.registrations}`}
                    />
                    <div
                      style={{ height: `${Math.max(4, renHeight * 1.4)}px` }}
                      className="flex-1 bg-violet-500 hover:bg-violet-600 rounded-t transition"
                      title={`Renewals: ${item.renewals}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-full">
                    {item.date.slice(5) || item.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2">
          <span>Total Pass Transactions</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {regData.reduce((acc, curr) => acc + curr.registrations + curr.renewals, 0)} passes
          </span>
        </div>
      </div>
    </div>
  );
}
