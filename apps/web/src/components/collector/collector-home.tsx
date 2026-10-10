'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/form-controls';
import {
  Search,
  UserPlus,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  FolderOpen,
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
}

export function CollectorHome({
  currentGate,
  onSelectWalker,
  onStartRegistration,
}: CollectorHomeProps) {
  const [walkers, setWalkers] = useState<CollectorWalkerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED'>('ALL');

  const fetchLiveWalkers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/walkers?pageSize=100');
      if (res.ok) {
        const json = await res.json();
        const items = json.data || json.walkers || [];
        const mapped: CollectorWalkerItem[] = items.map((w: Record<string, unknown>) => {
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
        setWalkers(mapped);
      } else {
        setWalkers([]);
      }
    } catch {
      setWalkers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveWalkers();
  }, [currentGate]);

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
    <div className="space-y-5 max-w-xl mx-auto">
      {/* Big Quick Register Hero Action */}
      <div className="bg-gradient-to-br from-park-900 to-park-800 text-white p-5 rounded-2xl shadow-lg flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
            Gate {currentGate} Desk
          </span>
          <h2 className="text-xl font-extrabold mt-0.5">Issue Walker Pass</h2>
          <p className="text-xs text-park-200 mt-1">₹200 Standard 30-Day Pass</p>
        </div>

        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-extrabold shadow-md shrink-0 h-12 px-5 text-sm gap-2"
          onClick={onStartRegistration}
        >
          <UserPlus className="w-5 h-5 text-amber-900" />
          <span>New Pass</span>
        </Button>
      </div>

      {/* KPI Status Badges */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          className={`p-3 rounded-xl border transition flex flex-col items-center justify-center gap-1 ${
            statusFilter === 'ACTIVE'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active
          </div>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100">
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'EXPIRING' ? 'ALL' : 'EXPIRING')}
          className={`p-3 rounded-xl border transition flex flex-col items-center justify-center gap-1 ${
            statusFilter === 'EXPIRING'
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" /> Expiring
          </div>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100">
            {expiringCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
          className={`p-3 rounded-xl border transition flex flex-col items-center justify-center gap-1 ${
            statusFilter === 'EXPIRED'
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Expired
          </div>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100">
            {expiredCount}
          </span>
        </button>
      </div>

      {/* Large Walker Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Name, Mobile, Pass No, or Receipt No..."
          className="pl-11 h-12 text-sm bg-white dark:bg-slate-900 rounded-xl shadow-xs border-slate-200 dark:border-slate-800"
        />
      </div>

      {/* Walker List Header & Refresh */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
          <span>Registered Pass Holders ({filteredWalkers.length})</span>
          <button
            type="button"
            onClick={fetchLiveWalkers}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Walkers List Cards */}
        <div className="space-y-2">
          {filteredWalkers.map((walker) => (
            <div
              key={walker.id}
              onClick={() => onSelectWalker(walker)}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs hover:border-park-600 cursor-pointer transition flex items-center justify-between gap-3 active:scale-[0.99]"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-park-800 dark:text-park-300 bg-park-100 dark:bg-park-950/80 px-2 py-0.5 rounded">
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

                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {walker.name}
                </h4>

                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3" />
                    {walker.phone}
                  </span>
                  <span>•</span>
                  <span>Slip: {walker.latestReceiptNo}</span>
                  <span>•</span>
                  <span className="font-medium">
                    {walker.daysRemaining > 0 ? `${walker.daysRemaining}d left` : 'Expired'}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </div>
          ))}

          {filteredWalkers.length === 0 && !isLoading && (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
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
                  size="sm"
                  variant="primary"
                  className="gap-2 mx-auto"
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
    </div>
  );
}
