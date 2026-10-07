'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  FileText,
  Lock,
} from 'lucide-react';
import { GATES } from '@wpd/shared';

interface AdminReportsViewProps {
  currentUserRole?: 'SUPER_ADMIN' | 'ADMIN' | 'COLLECTOR';
}

export function AdminReportsView({ currentUserRole = 'ADMIN' }: AdminReportsViewProps) {
  const [reportSubTab, setReportSubTab] = useState<
    'collections' | 'expiries' | 'reconciliation' | 'register'
  >('collections');
  const [selectedGate, setSelectedGate] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'monthly'>('daily');
  const [expiryThreshold, setExpiryThreshold] = useState<'7' | '15' | '30' | 'EXPIRED'>('7');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // If collector attempts to view admin reports
  if (currentUserRole === 'COLLECTOR') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Restricted Access</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Financial reporting, cash reconciliation registers, and collection analytics are strictly
          restricted to <strong>ADMIN</strong> and <strong>SUPER_ADMIN</strong> roles.
        </p>
      </div>
    );
  }

  const handleExport = (format: 'csv' | 'excel') => {
    setIsExporting(format);
    const params = new URLSearchParams({
      format,
      ...(selectedGate !== 'ALL' ? { gateId: selectedGate } : {}),
      startDate: `${selectedDate}T00:00:00.000Z`,
      endDate: `${selectedDate}T23:59:59.999Z`,
    });
    window.open(`/api/v1/reports/export/payments?${params.toString()}`, '_blank');
    setTimeout(() => setIsExporting(null), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Export Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <span>Gate:</span>
            <select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Gates (G2, GS, G9)</option>
              {GATES.map((g) => (
                <option key={g} value={g}>
                  Gate {g}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <span>Period:</span>
            <div className="inline-flex rounded-lg border bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setSelectedPeriod('daily')}
                className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                  selectedPeriod === 'daily'
                    ? 'bg-white shadow-xs text-indigo-700'
                    : 'text-slate-500'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriod('monthly')}
                className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                  selectedPeriod === 'monthly'
                    ? 'bg-white shadow-xs text-indigo-700'
                    : 'text-slate-500'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={isExporting !== null}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={isExporting !== null}
            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Excel (XLSX)
          </button>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setReportSubTab('collections')}
          className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition ${
            reportSubTab === 'collections'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Collections Summary
        </button>
        <button
          type="button"
          onClick={() => setReportSubTab('expiries')}
          className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition ${
            reportSubTab === 'expiries'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Pass Expiries (No Aadhaar)
        </button>
        <button
          type="button"
          onClick={() => setReportSubTab('reconciliation')}
          className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition ${
            reportSubTab === 'reconciliation'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Cash Reconciliation
        </button>
        <button
          type="button"
          onClick={() => setReportSubTab('register')}
          className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition ${
            reportSubTab === 'register'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Receipt Register & Gaps
        </button>
      </div>

      {/* Sub Tab: Collections Summary */}
      {reportSubTab === 'collections' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">TOTAL COLLECTED</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">₹48,200</span>
              <span className="text-[11px] text-slate-400">241 physical passes</span>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-xs">
              <span className="text-xs font-medium text-emerald-600 block">PHYSICAL CASH</span>
              <span className="text-2xl font-bold text-emerald-700 mt-1 block">₹32,600</span>
              <span className="text-[11px] text-emerald-600/80">163 slips (67.6%)</span>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-xs">
              <span className="text-xs font-medium text-indigo-600 block">UPI (QR SCAN)</span>
              <span className="text-2xl font-bold text-indigo-700 mt-1 block">₹15,600</span>
              <span className="text-[11px] text-indigo-600/80">78 slips (32.4%)</span>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">NEW VS RENEWALS</span>
              <div className="text-sm font-bold text-slate-800 mt-2 space-y-0.5">
                <div>New: 142 passes (₹28,400)</div>
                <div>Renewals: 99 passes (₹19,800)</div>
              </div>
            </div>
          </div>

          {/* Breakdown by Payment Gate */}
          <div className="bg-white rounded-xl border overflow-hidden shadow-xs">
            <div className="p-4 border-b bg-slate-50/70 font-semibold text-xs text-slate-700 uppercase tracking-wider">
              Breakdown by Payment Collection Gate
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b">
                <tr>
                  <th className="p-3">Gate</th>
                  <th className="p-3">Passes Issued</th>
                  <th className="p-3">Cash (Paise / INR)</th>
                  <th className="p-3">UPI (Paise / INR)</th>
                  <th className="p-3 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-semibold text-slate-800">Gate G2 (North Entrance)</td>
                  <td className="p-3">112 passes</td>
                  <td className="p-3 text-emerald-700 font-mono">₹14,800</td>
                  <td className="p-3 text-indigo-700 font-mono">₹7,600</td>
                  <td className="p-3 text-right font-bold text-slate-900 font-mono">₹22,400</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">Gate GS (South Entrance)</td>
                  <td className="p-3">78 passes</td>
                  <td className="p-3 text-emerald-700 font-mono">₹11,200</td>
                  <td className="p-3 text-indigo-700 font-mono">₹4,400</td>
                  <td className="p-3 text-right font-bold text-slate-900 font-mono">₹15,600</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">Gate G9 (East Entrance)</td>
                  <td className="p-3">51 passes</td>
                  <td className="p-3 text-emerald-700 font-mono">₹6,600</td>
                  <td className="p-3 text-indigo-700 font-mono">₹3,600</td>
                  <td className="p-3 text-right font-bold text-slate-900 font-mono">₹10,200</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab: Expiries */}
      {reportSubTab === 'expiries' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Threshold:</span>
            {(['7', '15', '30', 'EXPIRED'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setExpiryThreshold(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  expiryThreshold === t
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t === 'EXPIRED' ? 'Already Expired' : `Next ${t} Days`}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b">
                <tr>
                  <th className="p-3">Pass No</th>
                  <th className="p-3">Walker Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Last Gate</th>
                  <th className="p-3">Valid Until</th>
                  <th className="p-3">Days Left</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-mono font-bold text-indigo-600">WP-000842</td>
                  <td className="p-3 font-medium text-slate-900">Rajesh Verma</td>
                  <td className="p-3 text-slate-600">9876543210</td>
                  <td className="p-3">Gate G2</td>
                  <td className="p-3 font-medium">10 Oct 2026</td>
                  <td className="p-3 text-amber-600 font-bold">3 days left</td>
                  <td className="p-3 text-right">
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                      EXPIRING
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-mono font-bold text-indigo-600">WP-000891</td>
                  <td className="p-3 font-medium text-slate-900">Kavitha Reddy</td>
                  <td className="p-3 text-slate-600">9845112233</td>
                  <td className="p-3">Gate GS</td>
                  <td className="p-3 font-medium">12 Oct 2026</td>
                  <td className="p-3 text-amber-600 font-bold">5 days left</td>
                  <td className="p-3 text-right">
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                      EXPIRING
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="p-3 bg-slate-50 border-t text-[11px] text-slate-500 flex items-center justify-between">
              <span>Showing 2 records expiring soon</span>
              <span className="italic text-slate-400">
                * Note: Aadhaar numbers are strictly excluded from all expiry reports
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab: Cash Reconciliation */}
      {reportSubTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
            <Receipt className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <strong>End-of-Shift Cash Handover:</strong> Supervisors verify recorded cash
              collections against physical rupee currency handed over by gate collectors. Any
              shortage or excess is permanently recorded in the audit trail.
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b">
                <tr>
                  <th className="p-3">Collector</th>
                  <th className="p-3">Gate</th>
                  <th className="p-3">Cash Slips</th>
                  <th className="p-3">Expected Cash</th>
                  <th className="p-3">Handed Over</th>
                  <th className="p-3">Discrepancy</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-medium text-slate-900">Ramesh Kumar (G2 Day Shift)</td>
                  <td className="p-3">Gate G2</td>
                  <td className="p-3 font-mono">74 slips</td>
                  <td className="p-3 font-mono font-semibold">₹14,800</td>
                  <td className="p-3 font-mono text-emerald-700 font-bold">₹14,800</td>
                  <td className="p-3 font-mono text-slate-500">₹0</td>
                  <td className="p-3">
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 w-fit">
                      <CheckCircle2 className="w-3 h-3" /> BALANCED
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      View Slip
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-slate-900">Suresh Gowda (GS Shift)</td>
                  <td className="p-3">Gate GS</td>
                  <td className="p-3 font-mono">56 slips</td>
                  <td className="p-3 font-mono font-semibold">₹11,200</td>
                  <td className="p-3 font-mono text-amber-700 font-bold">₹11,180</td>
                  <td className="p-3 font-mono text-rose-600 font-bold">-₹20 (Shortage)</td>
                  <td className="p-3">
                    <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 w-fit">
                      <AlertTriangle className="w-3 h-3" /> SHORTAGE
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Edit Notes
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab: Physical Receipt Register & Gaps */}
      {reportSubTab === 'register' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <strong>Audit Integrity Check:</strong> The physical receipt register monitors paper
              slip booklet continuity across all gates. Any missing or skipped physical slip numbers
              are automatically flagged for investigation.
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Physical Slips Issued Today</span>
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                0 Sequence Gaps Detected
              </span>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b">
                <tr>
                  <th className="p-3">Receipt Slip No</th>
                  <th className="p-3">Pass No</th>
                  <th className="p-3">Walker Name</th>
                  <th className="p-3">Gate</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="p-3 font-bold text-slate-900">RC-000101</td>
                  <td className="p-3 text-indigo-600 font-semibold">PASS-00101</td>
                  <td className="p-3 font-sans font-medium text-slate-800">Ananya Sharma</td>
                  <td className="p-3 font-sans">Gate G2</td>
                  <td className="p-3">₹200.00</td>
                  <td className="p-3 font-sans">CASH</td>
                  <td className="p-3 text-right text-slate-400">10:14 IST</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-slate-900">RC-000102</td>
                  <td className="p-3 text-indigo-600 font-semibold">PASS-00102</td>
                  <td className="p-3 font-sans font-medium text-slate-800">Rajesh Verma</td>
                  <td className="p-3 font-sans">Gate G2</td>
                  <td className="p-3">₹200.00</td>
                  <td className="p-3 font-sans">UPI</td>
                  <td className="p-3 text-right text-slate-400">10:19 IST</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-slate-900">RC-000103</td>
                  <td className="p-3 text-indigo-600 font-semibold">PASS-00103</td>
                  <td className="p-3 font-sans font-medium text-slate-800">Kavitha Reddy</td>
                  <td className="p-3 font-sans">Gate GS</td>
                  <td className="p-3">₹200.00</td>
                  <td className="p-3 font-sans">CASH</td>
                  <td className="p-3 text-right text-slate-400">10:24 IST</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
