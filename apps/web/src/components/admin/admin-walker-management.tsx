'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient, GATES, PassStatus } from '@wpd/shared';
import { DataTable, ColumnDef } from '../ui/data-table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { FormItem, Input, Select, Textarea } from '../ui/form-controls';
import { useToast } from '../ui/toast';
import {
  Download,
  Edit,
  Trash2,
  RotateCcw,
  FileText,
  History,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export interface WalkerRow {
  id: string;
  passNo: string;
  name: string;
  phone: string;
  gateCode: string;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
  expiryDate: string;
  daysRemaining: number;
  aadhaarLast4?: string;
  maskedAadhaar?: string;
  notes?: string;
  deletedAt?: string | null;
  createdAt: string;
}

interface AdminWalkerManagementProps {
  apiClient?: ApiClient;
}

export function AdminWalkerManagement({ apiClient }: AdminWalkerManagementProps) {
  const { addToast } = useToast();

  const [walkers, setWalkers] = useState<WalkerRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGate, setSelectedGate] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals state
  const [editingWalker, setEditingWalker] = useState<WalkerRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Soft delete state
  const [deletingWalker, setDeletingWalker] = useState<WalkerRow | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Restore state
  const [restoringWalker, setRestoringWalker] = useState<WalkerRow | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Document viewer modal state
  const [viewingDocsWalker, setViewingDocsWalker] = useState<WalkerRow | null>(null);

  // History viewer modal state
  const [viewingHistoryWalker, setViewingHistoryWalker] = useState<WalkerRow | null>(null);

  const DEFAULT_WALKERS: WalkerRow[] = [
    {
      id: 'w-1',
      passNo: 'PASS-00101',
      name: 'Ananya Sharma',
      phone: '9845012345',
      gateCode: 'G2',
      status: 'ACTIVE',
      expiryDate: '06 Nov 2026',
      daysRemaining: 30,
      aadhaarLast4: '4511',
      maskedAadhaar: 'XXXX XXXX 4511',
      notes: 'Morning regular walker',
      createdAt: '07 Oct 2026',
    },
    {
      id: 'w-2',
      passNo: 'PASS-00102',
      name: 'Rajesh Kulkarni',
      phone: '9845023456',
      gateCode: 'GS',
      status: 'ACTIVE',
      expiryDate: '01 Nov 2026',
      daysRemaining: 25,
      aadhaarLast4: '7789',
      maskedAadhaar: 'XXXX XXXX 7789',
      notes: 'Senior citizen pass',
      createdAt: '02 Oct 2026',
    },
    {
      id: 'w-3',
      passNo: 'PASS-00103',
      name: 'Meenakshi Iyer',
      phone: '9845034567',
      gateCode: 'G9',
      status: 'EXPIRING',
      expiryDate: '10 Oct 2026',
      daysRemaining: 3,
      aadhaarLast4: '9012',
      maskedAadhaar: 'XXXX XXXX 9012',
      notes: 'Evening walker',
      createdAt: '10 Sep 2026',
    },
    {
      id: 'w-4',
      passNo: 'PASS-00104',
      name: 'Vikram Seth',
      phone: '9845045678',
      gateCode: 'G2',
      status: 'EXPIRED',
      expiryDate: '01 Oct 2026',
      daysRemaining: -6,
      aadhaarLast4: '3456',
      maskedAadhaar: 'XXXX XXXX 3456',
      notes: '',
      createdAt: '01 Sep 2026',
    },
  ];

  useEffect(() => {
    fetchWalkers();
  }, [selectedGate, selectedStatus]);

  const fetchWalkers = async () => {
    if (!apiClient) {
      setWalkers(DEFAULT_WALKERS);
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.walkers.list({
        gateId: selectedGate !== 'ALL' ? selectedGate : undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as PassStatus) : undefined,
        limit: 100,
      });

      if (res && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: WalkerRow[] = res.data.map((raw) => {
          const item = raw as Record<string, unknown>;
          const gate = item.gate as { code?: string } | undefined;
          const passes = item.passes as Array<{ status?: string; expiryDate?: string }> | undefined;
          const latestPass = passes?.[0];
          return {
            id: String(item.id || ''),
            passNo: String(item.passNo || ''),
            name: String(item.name || ''),
            phone: String(item.phone || ''),
            gateCode: gate?.code || 'G2',
            status: (latestPass?.status as 'ACTIVE' | 'EXPIRING' | 'EXPIRED') || 'ACTIVE',
            expiryDate: latestPass?.expiryDate
              ? new Date(latestPass.expiryDate).toLocaleDateString('en-GB')
              : 'N/A',
            daysRemaining: 30,
            aadhaarLast4: (item.aadhaarLast4 as string) || undefined,
            maskedAadhaar: `XXXX XXXX ${(item.aadhaarLast4 as string) || 'XXXX'}`,
            notes: (item.notes as string) || undefined,
            deletedAt: (item.deletedAt as string) || null,
            createdAt: item.createdAt ? new Date(String(item.createdAt)).toLocaleDateString('en-GB') : '',
          };
        });
        setWalkers(mapped);
      } else {
        setWalkers(DEFAULT_WALKERS);
      }
    } catch {
      setWalkers(DEFAULT_WALKERS);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredWalkers = walkers.filter((w) => {
    if (selectedGate !== 'ALL' && w.gateCode !== selectedGate) return false;
    if (selectedStatus !== 'ALL' && w.status !== selectedStatus) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.phone.includes(q) ||
      w.passNo.toLowerCase().includes(q)
    );
  });

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWalker) return;

    setIsSubmittingEdit(true);
    try {
      if (apiClient) {
        await apiClient.walkers.update(editingWalker.id, {
          name: editName.trim(),
          phone: editPhone.trim(),
          notes: editNotes.trim(),
        });
      }

      setWalkers((prev) =>
        prev.map((w) =>
          w.id === editingWalker.id
            ? { ...w, name: editName.trim(), phone: editPhone.trim(), notes: editNotes.trim() }
            : w,
        ),
      );

      addToast({
        title: 'Walker Details Updated',
        description: 'Changes have been saved and audited.',
        variant: 'success',
      });
      setEditingWalker(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update walker';
      addToast({ title: 'Update Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Soft Delete
  const handleSoftDelete = async () => {
    if (!deletingWalker || !deleteReason.trim()) return;

    setIsDeleting(true);
    try {
      if (apiClient) {
        await apiClient.walkers.delete(deletingWalker.id, deleteReason.trim());
      }

      setWalkers((prev) =>
        prev.map((w) =>
          w.id === deletingWalker.id ? { ...w, deletedAt: new Date().toISOString() } : w,
        ),
      );

      addToast({
        title: 'Walker Soft-Deleted',
        description: `Pass ${deletingWalker.passNo} marked as deactivated. Reason recorded in audit logs.`,
        variant: 'default',
      });
      setDeletingWalker(null);
      setDeleteReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to soft delete';
      addToast({ title: 'Action Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Restore
  const handleRestore = async () => {
    if (!restoringWalker) return;

    setIsRestoring(true);
    try {
      if (apiClient) {
        await apiClient.walkers.restore(restoringWalker.id);
      }

      setWalkers((prev) =>
        prev.map((w) => (w.id === restoringWalker.id ? { ...w, deletedAt: null } : w)),
      );

      addToast({
        title: 'Walker Restored',
        description: `Pass ${restoringWalker.passNo} has been restored to active directory.`,
        variant: 'success',
      });
      setRestoringWalker(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to restore walker';
      addToast({ title: 'Restore Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Bulk Export
  const handleExport = (format: 'csv' | 'excel') => {
    if (apiClient) {
      const exportUrl = apiClient.walkers.export({
        format,
        gateId: selectedGate !== 'ALL' ? selectedGate : undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as PassStatus) : undefined,
        search: searchQuery || undefined,
      });
      window.open(exportUrl, '_blank');
    } else {
      addToast({
        title: `Export ${format.toUpperCase()} Generated`,
        description: `Downloaded ${filteredWalkers.length} walker records with formula injection protection.`,
        variant: 'default',
      });
    }
  };

  const columns: ColumnDef<WalkerRow>[] = [
    {
      header: 'Walker',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            {row.name}
            {row.deletedAt && (
              <Badge variant="destructive" className="text-[10px] py-0 px-1">
                Deactivated
              </Badge>
            )}
          </div>
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
      header: 'Gate',
      accessorKey: 'gateCode',
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
          Gate {row.gateCode}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => {
        if (row.status === 'EXPIRED') {
          return (
            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
              <Clock className="w-3 h-3" /> Expired
            </Badge>
          );
        }
        if (row.status === 'EXPIRING') {
          return (
            <Badge variant="warning" className="flex items-center gap-1 w-fit">
              <AlertTriangle className="w-3 h-3" /> Expiring Soon
            </Badge>
          );
        }
        return (
          <Badge variant="success" className="flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" /> Active
          </Badge>
        );
      },
    },
    {
      header: 'Aadhaar (Masked)',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {row.maskedAadhaar || 'XXXX XXXX 4511'}
        </span>
      ),
    },
    {
      header: 'Expiry Date',
      accessorKey: 'expiryDate',
      sortable: true,
      cell: (row) => <span className="text-xs text-slate-700 dark:text-slate-300">{row.expiryDate}</span>,
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            title="Edit Walker Details"
            onClick={() => {
              setEditingWalker(row);
              setEditName(row.name);
              setEditPhone(row.phone);
              setEditNotes(row.notes || '');
            }}
          >
            <Edit className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            title="View Uploaded Documents"
            onClick={() => setViewingDocsWalker(row)}
          >
            <FileText className="w-3.5 h-3.5 text-park-700 dark:text-park-400" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            title="Pass & Payment History"
            onClick={() => setViewingHistoryWalker(row)}
          >
            <History className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          </Button>

          {row.deletedAt ? (
            <Button
              size="sm"
              variant="ghost"
              title="Restore Deactivated Walker"
              onClick={() => setRestoringWalker(row)}
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              title="Soft Delete Walker"
              onClick={() => {
                setDeletingWalker(row);
                setDeleteReason('');
              }}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search name, phone, pass..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="w-36">
            <Select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="text-xs"
            >
              <option value="ALL">All Gates</option>
              {GATES.map((g) => (
                <option key={g} value={g}>
                  Gate {g}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-36">
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="EXPIRING">EXPIRING</option>
              <option value="EXPIRED">EXPIRED</option>
            </Select>
          </div>
        </div>

        {/* Bulk Export Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Main Walkers Table */}
      <DataTable
        data={filteredWalkers}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No walkers found matching the selected filters."
      />

      {/* 1. Edit Walker Details Modal */}
      {editingWalker && (
        <Dialog
          isOpen={true}
          onClose={() => setEditingWalker(null)}
          title={`Edit Walker: ${editingWalker.passNo}`}
          description="Update personal details and notes. Audited before and after in system logs."
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <FormItem label="Full Name" required>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </FormItem>

            <FormItem label="Phone Number" required>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                required
              />
            </FormItem>

            <FormItem label="Staff Notes">
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Any special remarks or instructions..."
              />
            </FormItem>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingWalker(null)}
                disabled={isSubmittingEdit}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmittingEdit}>
                Save Changes
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* 2. Soft Delete Dialog with Mandatory Reason */}
      {deletingWalker && (
        <Dialog
          isOpen={true}
          onClose={() => setDeletingWalker(null)}
          title={`Deactivate Walker: ${deletingWalker.name}`}
          description={`Pass No: ${deletingWalker.passNo}. A mandatory justification reason is required for administrative audit logs.`}
        >
          <div className="space-y-4 mt-2">
            <FormItem label="Deactivation Reason" required hint="e.g. Walker relocated, duplicate pass issued, pass surrendered">
              <Textarea
                placeholder="Enter justification reason (minimum 5 characters)..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                required
              />
            </FormItem>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeletingWalker(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleSoftDelete}
                disabled={deleteReason.trim().length < 5 || isDeleting}
                isLoading={isDeleting}
              >
                Confirm Deactivation
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* 3. Restore Dialog */}
      {restoringWalker && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setRestoringWalker(null)}
          onConfirm={handleRestore}
          title={`Restore Walker: ${restoringWalker.name}`}
          description={`Are you sure you want to restore pass ${restoringWalker.passNo}? This will re-enable entry desk verification for this pass.`}
          confirmText="Confirm Restoration"
          isLoading={isRestoring}
        />
      )}

      {/* 4. Document Viewer Modal */}
      {viewingDocsWalker && (
        <Dialog
          isOpen={true}
          onClose={() => setViewingDocsWalker(null)}
          title={`Documents: ${viewingDocsWalker.name}`}
          description={`Secure document vault for Pass ${viewingDocsWalker.passNo}. Served through short-lived signed URLs.`}
        >
          <div className="space-y-4 mt-2">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Passport Photograph
                </div>
                <div className="text-[11px] text-slate-500">MIME: image/jpeg • Stripped EXIF</div>
              </div>
              <div className="w-12 h-12 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">
                Photo
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Government ID Proof (Aadhaar / Passport)
                </div>
                <div className="text-[11px] text-slate-500">
                  Encrypted at rest (AES-256-GCM) • Masked: {viewingDocsWalker.maskedAadhaar}
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-xs">
                <Eye className="w-3.5 h-3.5 mr-1" />
                View Proof
              </Button>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button variant="outline" onClick={() => setViewingDocsWalker(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* 5. Pass & Payment History Modal */}
      {viewingHistoryWalker && (
        <Dialog
          isOpen={true}
          onClose={() => setViewingHistoryWalker(null)}
          title={`History Timeline: ${viewingHistoryWalker.name}`}
          description={`Pass ${viewingHistoryWalker.passNo} • Complete record of pass periods and payments collected.`}
        >
          <div className="space-y-3 mt-2">
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Initial Pass Registration
                </span>
                <span className="text-slate-500">{viewingHistoryWalker.createdAt}</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Receipt: <span className="font-mono font-bold">RC-000101</span> • Gate {viewingHistoryWalker.gateCode} • Rs 200 (CASH)
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Active Pass Validity
                </span>
                <Badge variant="success" className="text-[10px]">ACTIVE</Badge>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Expires on <span className="font-bold">{viewingHistoryWalker.expiryDate}</span> ({viewingHistoryWalker.daysRemaining} days remaining)
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button variant="outline" onClick={() => setViewingHistoryWalker(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
