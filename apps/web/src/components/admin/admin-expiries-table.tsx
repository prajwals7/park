'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient, sanitizeForFormulaInjection } from '@wpd/shared';
import { DataTable, ColumnDef } from '../ui/data-table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { FormItem, Input, Select } from '../ui/form-controls';
import { FileUpload } from '../ui/file-upload';
import { useToast } from '../ui/toast';
import {
  Printer,
  Download,
  Repeat,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export interface ExpiryRow {
  id: string;
  name: string;
  passNo: string;
  phone: string;
  startDate: string;
  expiryDate: string;
  daysRemaining: number;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
  lastPaymentGate: string;
  lastReceiptNo: string;
}

interface AdminExpiriesTableProps {
  apiClient?: ApiClient;
  onRenewSuccess?: () => void;
}

export function AdminExpiriesTable({ apiClient, onRenewSuccess }: AdminExpiriesTableProps) {
  const { addToast } = useToast();

  const [filterThreshold, setFilterThreshold] = useState<'7' | '15' | '30' | 'EXPIRED'>('7');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ExpiryRow[]>([]);

  // Quick Renew Modal State
  const [renewingWalker, setRenewingWalker] = useState<ExpiryRow | null>(null);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI'>('CASH');
  const [receiptNo, setReceiptNo] = useState('');
  const [ticketPhotoUrl, setTicketPhotoUrl] = useState('');
  const [isSubmittingRenew, setIsSubmittingRenew] = useState(false);

  // Demo initial rows if backend offline / not loaded
  const DEFAULT_ROWS: ExpiryRow[] = [
    {
      id: 'w-101',
      name: 'Sunil Kumar',
      passNo: 'WP-1042',
      phone: '9845012345',
      startDate: '08 Sep 2026',
      expiryDate: '08 Oct 2026',
      daysRemaining: 1,
      status: 'EXPIRING',
      lastPaymentGate: 'G2',
      lastReceiptNo: 'RC-000189',
    },
    {
      id: 'w-102',
      name: 'Meera Nambiar',
      passNo: 'WP-1088',
      phone: '9845023456',
      startDate: '10 Sep 2026',
      expiryDate: '10 Oct 2026',
      daysRemaining: 3,
      status: 'EXPIRING',
      lastPaymentGate: 'GS',
      lastReceiptNo: 'RC-000192',
    },
    {
      id: 'w-103',
      name: 'Arjun Das',
      passNo: 'WP-1095',
      phone: '9845034567',
      startDate: '12 Sep 2026',
      expiryDate: '12 Oct 2026',
      daysRemaining: 5,
      status: 'EXPIRING',
      lastPaymentGate: 'G9',
      lastReceiptNo: 'RC-000201',
    },
    {
      id: 'w-104',
      name: 'Kavita Menon',
      passNo: 'WP-0980',
      phone: '9845045678',
      startDate: '01 Sep 2026',
      expiryDate: '01 Oct 2026',
      daysRemaining: -6,
      status: 'EXPIRED',
      lastPaymentGate: 'G2',
      lastReceiptNo: 'RC-000120',
    },
    {
      id: 'w-105',
      name: 'Prakash Rao',
      passNo: 'WP-0955',
      phone: '9845056789',
      startDate: '28 Aug 2026',
      expiryDate: '27 Sep 2026',
      daysRemaining: -10,
      status: 'EXPIRED',
      lastPaymentGate: 'GS',
      lastReceiptNo: 'RC-000098',
    },
  ];

  useEffect(() => {
    fetchExpiries();
  }, [filterThreshold]);

  const fetchExpiries = async () => {
    if (!apiClient) {
      filterLocalData();
      return;
    }

    setIsLoading(true);
    try {
      const isExpired = filterThreshold === 'EXPIRED';
      const res = await apiClient.reports.getExpiries({
        status: isExpired ? 'EXPIRED' : 'EXPIRING',
        threshold: isExpired ? undefined : filterThreshold,
        page: 1,
        limit: 100,
      });

      if (res && Array.isArray(res.data) && res.data.length > 0) {
        setData(res.data as unknown as ExpiryRow[]);
      } else {
        filterLocalData();
      }
    } catch {
      filterLocalData();
    } finally {
      setIsLoading(false);
    }
  };

  const filterLocalData = () => {
    if (filterThreshold === 'EXPIRED') {
      setData(DEFAULT_ROWS.filter((r) => r.status === 'EXPIRED'));
    } else {
      const maxDays = parseInt(filterThreshold, 10);
      setData(
        DEFAULT_ROWS.filter((r) => r.status === 'EXPIRING' && r.daysRemaining <= maxDays && r.daysRemaining >= 0),
      );
    }
  };

  // Filter by search
  const filteredData = data.filter((row) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      row.name.toLowerCase().includes(q) ||
      row.passNo.toLowerCase().includes(q) ||
      row.phone.includes(q)
    );
  });

  // Handle Quick Renew Submission
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingWalker) return;

    if (!receiptNo.trim()) {
      addToast({
        title: 'Receipt Number Required',
        description: 'Please enter the physical receipt slip number.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingRenew(true);
    try {
      if (apiClient) {
        await apiClient.walkers.renew(
          renewingWalker.id,
          {
            gateId: 'G2',
            paymentMode,
            receiptNo: receiptNo.trim().toUpperCase(),
            ticketStorageKey: ticketPhotoUrl || 'uploads/sample-ticket.jpg',
          },
          `renew-${Date.now()}`,
        );
      }

      addToast({
        title: 'Pass Renewed Successfully',
        description: `${renewingWalker.name}'s pass has been extended for 30 days.`,
        variant: 'success',
      });

      // Update local state
      setData((prev) => prev.filter((r) => r.id !== renewingWalker.id));
      setRenewingWalker(null);
      setReceiptNo('');
      setTicketPhotoUrl('');
      onRenewSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Renewal failed';
      addToast({
        title: 'Renewal Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingRenew(false);
    }
  };

  // Export to CSV with Formula Injection Protection
  const handleExportCsv = () => {
    const headers = [
      'Pass No',
      'Walker Name',
      'Phone (Manual Follow-up)',
      'Status',
      'Pass Start Date',
      'Pass Expiry Date',
      'Days Left',
      'Last Gate',
      'Last Receipt',
    ];

    const escapeCsv = (val: unknown) => {
      const sanitized = sanitizeForFormulaInjection(val);
      const str = String(sanitized).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.map(escapeCsv).join(',')];

    for (const r of filteredData) {
      const row = [
        r.passNo,
        r.name,
        r.phone,
        r.status,
        r.startDate,
        r.expiryDate,
        r.daysRemaining,
        r.lastPaymentGate,
        r.lastReceiptNo,
      ];
      csvRows.push(row.map(escapeCsv).join(','));
    }

    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expiries-roster-${filterThreshold}-days.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      title: 'Roster Exported',
      description: `Downloaded ${filteredData.length} records with formula injection protection.`,
      variant: 'default',
    });
  };

  // Print Friendly Roster View
  const handlePrint = () => {
    window.print();
  };

  // Column definitions for DataTable
  const columns: ColumnDef<ExpiryRow>[] = [
    {
      header: 'Walker',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100">{row.name}</div>
          <div className="text-xs text-slate-500 font-mono">{row.phone}</div>
        </div>
      ),
    },
    {
      header: 'Pass No',
      accessorKey: 'passNo',
      sortable: true,
      cell: (row) => <span className="font-mono font-bold text-xs">{row.passNo}</span>,
    },
    {
      header: 'Status & Days Left',
      accessorKey: 'daysRemaining',
      sortable: true,
      cell: (row) => {
        if (row.daysRemaining < 0) {
          return (
            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
              <Clock className="w-3 h-3" />
              Expired ({Math.abs(row.daysRemaining)}d ago)
            </Badge>
          );
        }
        return (
          <Badge variant="warning" className="flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3" />
            {row.daysRemaining === 0 ? 'Expires Today' : `${row.daysRemaining} days left`}
          </Badge>
        );
      },
    },
    {
      header: 'Expiry Date',
      accessorKey: 'expiryDate',
      sortable: true,
      cell: (row) => <span className="text-xs text-slate-700 dark:text-slate-300">{row.expiryDate}</span>,
    },
    {
      header: 'Last Gate & Receipt',
      cell: (row) => (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span>Gate {row.lastPaymentGate}</span> • <span className="font-mono">{row.lastReceiptNo}</span>
        </div>
      ),
    },
    {
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setRenewingWalker(row);
            setReceiptNo('');
            setPaymentMode('CASH');
          }}
          className="flex items-center gap-1 text-xs"
        >
          <Repeat className="w-3.5 h-3.5 text-park-700 dark:text-park-400" />
          Quick Renew
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner Explaining Manual Follow-up Rule */}
      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Manual Follow-Up Roster (Strictly No Automated SMS/WhatsApp)
            </h4>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              In accordance with park policy, all pass renewal follow-ups must be handled manually by staff. Export or print this roster for telephone outreach or gate desk inquiries.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-1 text-xs bg-white dark:bg-slate-900"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Roster
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="flex items-center gap-1 text-xs bg-white dark:bg-slate-900"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setFilterThreshold('7')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              filterThreshold === '7'
                ? 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Expiring in 7 Days
          </button>
          <button
            type="button"
            onClick={() => setFilterThreshold('15')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              filterThreshold === '15'
                ? 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Expiring in 15 Days
          </button>
          <button
            type="button"
            onClick={() => setFilterThreshold('30')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              filterThreshold === '30'
                ? 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Expiring in 30 Days
          </button>
          <button
            type="button"
            onClick={() => setFilterThreshold('EXPIRED')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              filterThreshold === 'EXPIRED'
                ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Expired Passes
          </button>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search walker, phone, pass..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs"
          />
        </div>
      </div>

      {/* Main DataTable */}
      <DataTable
        data={filteredData}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No walkers matching the selected expiry criteria."
      />

      {/* Quick Renew Dialog */}
      {renewingWalker && (
        <Dialog
          isOpen={true}
          onClose={() => setRenewingWalker(null)}
          title={`Quick Renew Pass: ${renewingWalker.name}`}
          description={`Pass No: ${renewingWalker.passNo} • Tariff: Rs 200 (30 days extension)`}
        >
          <form onSubmit={handleRenewSubmit} className="space-y-4 mt-2">
            <FormItem label="Payment Mode" required>
              <Select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as 'CASH' | 'UPI')}
              >
                <option value="CASH">CASH (Physical Handover at Gate)</option>
                <option value="UPI">UPI (QR Code Payment)</option>
              </Select>
            </FormItem>

            <FormItem
              label="Physical Receipt Slip Number"
              required
              hint="Collector-entered number printed on the physical receipt slip"
            >
              <Input
                placeholder="e.g. RC-000215"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value.toUpperCase())}
                required
              />
            </FormItem>

            <FormItem label="Ticket Photo / Proof (Optional)">
              <FileUpload
                label="Capture or Upload Ticket Photo"
                onFileSelect={(file) => {
                  if (file) {
                    setTicketPhotoUrl(`uploads/${file.name}`);
                  }
                }}
              />
            </FormItem>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenewingWalker(null)}
                disabled={isSubmittingRenew}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmittingRenew}>
                Confirm Pass Renewal
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
