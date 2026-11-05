'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/form-controls';
import { useToast } from '../ui/toast';
import {
  getRecordedPasses,
  renewRecordedPass,
  getNextSuggestedPassAndReceipt,
  getGateShiftSummary,
  GateShiftSummary,
} from '@/lib/pass-store';
import {
  Search,
  UserPlus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  Zap,
  Banknote,
  CreditCard,
  X,
  PhoneCall,
  Loader2,
} from 'lucide-react';

export interface CollectorWalkerItem {
  id: string;
  passNo: string;
  name: string;
  phone: string;
  gateId: string;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
  expiryDate: string;
  daysRemaining: number;
  latestReceiptNo: string;
  latestPaymentMode: 'CASH' | 'UPI';
}

export interface CollectorHomeProps {
  currentGate: string;
  onSelectWalker: (walker: CollectorWalkerItem) => void;
  onStartRegistration: () => void;
  onOpenShift?: () => void;
}

export function CollectorHome({
  currentGate,
  onSelectWalker,
  onStartRegistration,
  onOpenShift,
}: CollectorHomeProps) {
  const { toast } = useToast();
  const [walkers, setWalkers] = useState<CollectorWalkerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED'>('ALL');
  const [shiftData, setShiftData] = useState<GateShiftSummary | null>(null);

  // Fast Renew Dialog State
  const [fastRenewTarget, setFastRenewTarget] = useState<CollectorWalkerItem | null>(null);
  const [renewSlipNo, setRenewSlipNo] = useState('');
  const [renewPaymentMode, setRenewPaymentMode] = useState<'CASH' | 'UPI'>('CASH');
  const [isRenewing, setIsRenewing] = useState(false);

  // Load walkers combining local recorded store and live API
  const fetchLiveWalkers = useCallback(async () => {
    setIsLoading(true);

    // 1. Always load local passes first for instantaneous UI & offline resilience
    const localPasses = getRecordedPasses();
    const now = Date.now();
    const localItems: CollectorWalkerItem[] = localPasses.map((p) => {
      const expiry = new Date(p.expiryDate).getTime();
      const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      return {
        id: p.id,
        passNo: p.passNo,
        name: p.name,
        phone: p.phone,
        gateId: p.gateId,
        status: daysLeft <= 0 ? 'EXPIRED' : daysLeft <= 7 ? 'EXPIRING' : 'ACTIVE',
        expiryDate: new Date(p.expiryDate).toLocaleDateString('en-GB'),
        daysRemaining: daysLeft > 0 ? daysLeft : 0,
        latestReceiptNo: p.receiptNo,
        latestPaymentMode: p.paymentMode,
      };
    });

    try {
      const res = await fetch('/api/v1/walkers?pageSize=100');
      if (res.ok) {
        const json = await res.json();
        const apiItems = json.data || json.walkers || [];
        const mappedApi: CollectorWalkerItem[] = apiItems.map((w: Record<string, unknown>) => {
          const currentPass = w.currentPass as Record<string, unknown> | undefined;
          const latestPayment = w.latestPayment as Record<string, unknown> | undefined;
          return {
            id: String(w.id || ''),
            passNo: String(currentPass?.passNo || w.passNo || 'N/A'),
            name: String(w.name || ''),
            phone: String(w.phone || ''),
            gateId: String(w.gateCode || w.gateId || currentGate),
            status: (currentPass?.status || w.status || 'ACTIVE') as 'ACTIVE' | 'EXPIRING' | 'EXPIRED',
            expiryDate: currentPass?.validUntil
              ? new Date(String(currentPass.validUntil)).toLocaleDateString('en-GB')
              : 'N/A',
            daysRemaining: typeof currentPass?.daysRemaining === 'number' ? currentPass.daysRemaining : 30,
            latestReceiptNo: String(latestPayment?.receiptNo || 'N/A'),
            latestPaymentMode: (latestPayment?.mode as 'CASH' | 'UPI') || 'CASH',
          };
        });

        // Merge: local passes take priority for most recent offline creations
        const seenIds = new Set<string>();
        const merged: CollectorWalkerItem[] = [];

        for (const item of localItems) {
          if (!seenIds.has(item.id) && !seenIds.has(item.passNo)) {
            seenIds.add(item.id);
            seenIds.add(item.passNo);
            merged.push(item);
          }
        }
        for (const item of mappedApi) {
          if (!seenIds.has(item.id) && !seenIds.has(item.passNo)) {
            seenIds.add(item.id);
            seenIds.add(item.passNo);
            merged.push(item);
          }
        }
        setWalkers(merged);
      } else {
        setWalkers(localItems);
      }
    } catch {
      setWalkers(localItems);
    } finally {
      setIsLoading(false);
      setShiftData(getGateShiftSummary(currentGate));
    }
  }, [currentGate]);

  useEffect(() => {
    fetchLiveWalkers();
    const handleUpdate = () => fetchLiveWalkers();
    window.addEventListener('wpd_data_updated', handleUpdate);
    return () => window.removeEventListener('wpd_data_updated', handleUpdate);
  }, [fetchLiveWalkers]);

  // Open fast renewal dialog for a walker
  const handleOpenFastRenew = (e: React.MouseEvent, walker: CollectorWalkerItem) => {
    e.stopPropagation();
    const suggestion = getNextSuggestedPassAndReceipt();
    setRenewSlipNo(suggestion.receiptNo);
    setRenewPaymentMode('CASH');
    setFastRenewTarget(walker);
  };

  // Submit fast renewal
  const handleFastRenewSubmit = async () => {
    if (!fastRenewTarget) return;
    if (renewSlipNo.trim().length < 3) {
      toast({
        type: 'error',
        title: 'Invalid Slip Number',
        message: 'Please enter a valid receipt slip number from your book.',
      });
      return;
    }

    setIsRenewing(true);
    try {
      renewRecordedPass(fastRenewTarget.id || fastRenewTarget.passNo, {
        receiptNo: renewSlipNo.trim().toUpperCase(),
        paymentMode: renewPaymentMode,
        gateId: currentGate,
      });

      toast({
        type: 'success',
        title: 'Pass Renewed for 30 Days',
        message: `${fastRenewTarget.name} renewed with slip ${renewSlipNo.trim().toUpperCase()}.`,
      });
      setFastRenewTarget(null);
      fetchLiveWalkers();
    } catch {
      toast({
        type: 'error',
        title: 'Renewal Failed',
        message: 'Could not record renewal. Please retry.',
      });
    } finally {
      setIsRenewing(false);
    }
  };

  // Metric counts
  const activeCount = walkers.filter((w) => w.status === 'ACTIVE').length;
  const expiringCount = walkers.filter((w) => w.status === 'EXPIRING').length;
  const expiredCount = walkers.filter((w) => w.status === 'EXPIRED').length;

  // Filtered walkers
  const filteredWalkers = useMemo(() => {
    return walkers.filter((w) => {
      if (statusFilter !== 'ALL' && w.status !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        w.phone.includes(q) ||
        w.passNo.toLowerCase().includes(q) ||
        w.latestReceiptNo.toLowerCase().includes(q)
      );
    });
  }, [walkers, searchQuery, statusFilter]);

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-12">
      {/* 1. Mobile Shift Cash Strip (Instant Gate Awareness) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>Gate {currentGate} Shift</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
              ₹{shiftData?.totalRevenueInr?.toFixed(2) || '0.00'}{' '}
              <span className="text-xs font-normal text-slate-500">
                (Cash: ₹{shiftData?.cashAmountInr?.toFixed(2) || '0.00'})
              </span>
            </div>
          </div>
        </div>

        {onOpenShift && (
          <button
            type="button"
            onClick={onOpenShift}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold shrink-0 transition"
          >
            Shift Cash
          </button>
        )}
      </div>

      {/* 2. Primary Hero Action: Issue Walker Pass */}
      <div className="bg-gradient-to-br from-park-900 via-park-950 to-emerald-950 text-white p-5 rounded-3xl shadow-md flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider">
            Fast Ticket Counter
          </span>
          <h2 className="text-xl font-black mt-0.5 tracking-tight">Issue Walker Pass</h2>
          <p className="text-xs text-park-200 mt-1">₹200.00 • 30-Day Physical Pass</p>
        </div>

        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-black shadow-lg shrink-0 h-13 px-5 text-sm gap-2 rounded-2xl active:scale-95 transition"
          onClick={onStartRegistration}
        >
          <UserPlus className="w-5 h-5 text-amber-950 stroke-[2.5]" />
          <span>New Pass</span>
        </Button>
      </div>

      {/* 3. Fast KPI Filter Pills (Large 48px Touch Targets) */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          className={`py-3 px-2 rounded-2xl border transition flex flex-col items-center justify-center gap-0.5 ${
            statusFilter === 'ACTIVE'
              ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active
          </div>
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'EXPIRING' ? 'ALL' : 'EXPIRING')}
          className={`py-3 px-2 rounded-2xl border transition flex flex-col items-center justify-center gap-0.5 ${
            statusFilter === 'EXPIRING'
              ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" /> Expiring
          </div>
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {expiringCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
          className={`py-3 px-2 rounded-2xl border transition flex flex-col items-center justify-center gap-0.5 ${
            statusFilter === 'EXPIRED'
              ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Expired
          </div>
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            {expiredCount}
          </span>
        </button>
      </div>

      {/* 4. Large Search Input (16px base font to prevent auto-zoom on mobile) */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Name, Phone, Pass No, or Slip..."
          className="pl-11 pr-10 h-12 text-base sm:text-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xs border-slate-200 dark:border-slate-800"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="w-8 h-8 absolute right-2.5 top-2 flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 5. Walker Registry List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
          <span>Pass Holders ({filteredWalkers.length})</span>
          <button
            type="button"
            onClick={fetchLiveWalkers}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold p-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Walkers List Cards */}
        <div className="space-y-2.5">
          {filteredWalkers.map((walker) => (
            <div
              key={walker.id}
              onClick={() => onSelectWalker(walker)}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs hover:border-park-600 cursor-pointer transition active:scale-[0.99] space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-park-800 dark:text-park-300 bg-park-100 dark:bg-park-950/80 px-2 py-0.5 rounded-md">
                      {walker.passNo}
                    </span>
                    <Badge
                      variant={
                        walker.status === 'ACTIVE'
                          ? 'active'
                          : walker.status === 'EXPIRING'
                            ? 'expiring'
                            : 'expired'
                      }
                    >
                      {walker.status}
                    </Badge>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {walker.name}
                  </h4>
                </div>

                {/* Direct 1-tap Fast Renew Button for expiring/expired passes */}
                {walker.status !== 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={(e) => handleOpenFastRenew(e, walker)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Renew</span>
                  </button>
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                )}
              </div>

              {/* Walker Details & Phone Call Link */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <a
                  href={`tel:${walker.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 font-mono font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-600 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60"
                >
                  <PhoneCall className="w-3 h-3 text-emerald-600" />
                  <span>{walker.phone}</span>
                </a>

                <div className="flex items-center gap-2 text-[11px]">
                  <span>Slip: <strong className="font-mono text-slate-700 dark:text-slate-300">{walker.latestReceiptNo}</strong></span>
                  <span>•</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {walker.daysRemaining > 0 ? `${walker.daysRemaining}d left` : 'Expired'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {filteredWalkers.length === 0 && !isLoading && (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {searchQuery ? `No walkers matching "${searchQuery}"` : 'No passes issued yet'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  {searchQuery
                    ? 'Check the mobile number or physical pass number and try again.'
                    : 'The park registry is clean. Tap below to issue the first pass.'}
                </p>
              </div>
              {!searchQuery && (
                <Button
                  type="button"
                  size="md"
                  variant="primary"
                  className="gap-2 mx-auto rounded-xl"
                  onClick={onStartRegistration}
                >
                  <UserPlus className="w-4 h-4" />
                  Issue First Pass
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. Mobile Floating Action Button (FAB) for fast thumb reach */}
      <div className="md:hidden fixed bottom-20 right-4 z-30">
        <button
          type="button"
          onClick={onStartRegistration}
          className="h-14 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl flex items-center gap-2 font-black text-sm ring-4 ring-emerald-500/20 active:scale-95 transition"
        >
          <UserPlus className="w-5 h-5 stroke-[2.5]" />
          <span>New Pass</span>
        </button>
      </div>

      {/* 7. Fast Renew Modal */}
      {fastRenewTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={() => setFastRenewTarget(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-6 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Fast 30-Day Renewal
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {fastRenewTarget.name}
                </h3>
                <span className="font-mono text-xs text-slate-500">
                  Pass: {fastRenewTarget.passNo}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFastRenewTarget(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Slip Number Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Receipt Slip Number *
              </label>
              <Input
                value={renewSlipNo}
                onChange={(e) => setRenewSlipNo(e.target.value.toUpperCase())}
                placeholder="e.g. RC-000105"
                className="h-12 font-mono font-bold uppercase text-base sm:text-sm rounded-xl"
              />
              <p className="text-[11px] text-slate-500">
                Auto-suggested from sequential receipt book.
              </p>
            </div>

            {/* Payment Mode Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Payment Collected (₹200.00) *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRenewPaymentMode('CASH')}
                  className={`h-13 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition ${
                    renewPaymentMode === 'CASH'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm ring-2 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  Cash ₹200
                </button>
                <button
                  type="button"
                  onClick={() => setRenewPaymentMode('UPI')}
                  className={`h-13 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition ${
                    renewPaymentMode === 'UPI'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-sm ring-2 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  UPI QR ₹200
                </button>
              </div>
            </div>

            {/* Submit Action */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isRenewing}
                onClick={handleFastRenewSubmit}
                className="w-full h-13 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition disabled:opacity-50"
              >
                {isRenewing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirm & Issue 30-Day Renewal
              </button>

              <button
                type="button"
                onClick={() => setFastRenewTarget(null)}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
