'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Search,
  UserPlus,
  Phone,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
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

const DEMO_COLLECTOR_WALKERS: CollectorWalkerItem[] = [
  {
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
  },
  {
    id: 'w-2',
    passNo: 'WP-1002',
    name: 'Rajesh Verma',
    phone: '9876543210',
    gateId: 'G2',
    status: 'EXPIRING',
    expiryDate: '10 Oct 2026',
    daysRemaining: 3,
    latestReceiptNo: 'RC-000102',
    latestPaymentMode: 'UPI',
  },
  {
    id: 'w-3',
    passNo: 'WP-1003',
    name: 'Kavitha Reddy',
    phone: '9845112233',
    gateId: 'GS',
    status: 'ACTIVE',
    expiryDate: '28 Oct 2026',
    daysRemaining: 20,
    latestReceiptNo: 'RC-000103',
    latestPaymentMode: 'CASH',
  },
  {
    id: 'w-4',
    passNo: 'WP-1004',
    name: 'Mohammed Farooq',
    phone: '9741223344',
    gateId: 'G9',
    status: 'EXPIRED',
    expiryDate: '02 Oct 2026',
    daysRemaining: -5,
    latestReceiptNo: 'RC-000088',
    latestPaymentMode: 'CASH',
  },
  {
    id: 'w-5',
    passNo: 'WP-1005',
    name: 'Siddharth Rao',
    phone: '9900112233',
    gateId: 'G2',
    status: 'ACTIVE',
    expiryDate: '04 Nov 2026',
    daysRemaining: 27,
    latestReceiptNo: 'RC-000105',
    latestPaymentMode: 'UPI',
  },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED'>(
    'ALL',
  );

  // Metric counts
  const activeCount = DEMO_COLLECTOR_WALKERS.filter((w) => w.status === 'ACTIVE').length;
  const expiringCount = DEMO_COLLECTOR_WALKERS.filter((w) => w.status === 'EXPIRING').length;
  const expiredCount = DEMO_COLLECTOR_WALKERS.filter((w) => w.status === 'EXPIRED').length;

  // Filtered walkers
  const filteredWalkers = useMemo(() => {
    return DEMO_COLLECTOR_WALKERS.filter((w) => {
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
  }, [searchQuery, statusFilter]);

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* Big Quick Register Hero Action (One-Handed Phone friendly) */}
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
          variant="accent"
          onClick={onStartRegistration}
          className="h-13 px-5 rounded-xl font-extrabold text-sm shadow-md shrink-0 flex items-center gap-1.5"
        >
          <UserPlus className="w-5 h-5" />+ New Pass
        </Button>
      </div>

      {/* KPI Metric Badges (Filter toggles) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          className={`p-3 rounded-xl border text-center transition ${
            statusFilter === 'ACTIVE'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            {activeCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'EXPIRING' ? 'ALL' : 'EXPIRING')}
          className={`p-3 rounded-xl border text-center transition ${
            statusFilter === 'EXPIRING'
              ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" /> EXPIRING
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            {expiringCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
          className={`p-3 rounded-xl border text-center transition ${
            statusFilter === 'EXPIRED'
              ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" /> EXPIRED
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            {expiredCount}
          </div>
        </button>
      </div>

      {/* Big Search Input (Name, Phone, Pass No) */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Name, Phone, Pass No..."
          className="w-full pl-11 pr-4 h-12 text-sm font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-park-700"
        />
      </div>

      {/* Walkers List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
          <span>RECORDED PASSES ({filteredWalkers.length})</span>
          {statusFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className="text-park-700 dark:text-park-400 underline"
            >
              Clear Filter
            </button>
          )}
        </div>

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

          {filteredWalkers.length === 0 && (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border rounded-xl space-y-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No walkers matching &quot;{searchQuery}&quot;
              </p>
              <p className="text-xs text-slate-400">
                Try searching by 10-digit mobile number or pass ID.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
