'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient, UserRole } from '@wpd/shared';
import { DataTable, ColumnDef } from '../ui/data-table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { FormItem, Input, Select, Textarea } from '../ui/form-controls';
import { useToast } from '../ui/toast';
import {
  getRecruitedCollectors,
  saveRecruitedCollector,
  toggleRecruitedCollectorStatus,
  deleteRecruitedCollector,
  cancelRecruitedCollector,
  generateCollectorId,
  RecruitedCollector,
} from '../../lib/pass-store';
import {
  UserPlus,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Sparkles,
  Users,
  Trash2,
  Lock,
  Printer,
  Ban,
  QrCode,
  CreditCard,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

export interface UserRow {
  id: string;
  collectorId?: string;
  name: string;
  email: string;
  phone: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'COLLECTOR';
  status: 'ACTIVE' | 'DISABLED' | 'CANCELLED';
  has2FA: boolean;
  failedLogins?: number;
  lastLoginAt?: string | null;
  createdAt: string;
  assignedGate?: string;
  shift?: string;
  isRecruited?: boolean;
  cancelledAt?: string;
  cancelReason?: string;
}

interface AdminUserManagementProps {
  apiClient?: ApiClient;
}

export function AdminUserManagement({ apiClient }: AdminUserManagementProps) {
  const { addToast } = useToast();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');

  // 1. Recruit Collector Modal State
  const [isRecruitingCollector, setIsRecruitingCollector] = useState(false);
  const [recName, setRecName] = useState('');
  const [recGate, setRecGate] = useState<'G2' | 'GS' | 'G9'>('G2');
  const [recShift, setRecShift] = useState<'MORNING' | 'GENERAL' | 'EVENING'>('MORNING');
  const [recPhone, setRecPhone] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recPassword, setRecPassword] = useState('Collector@123');
  const [recCollectorId, setRecCollectorId] = useState('');
  const [isSubmittingRecruit, setIsSubmittingRecruit] = useState(false);

  // 2. Generic Create Staff User Modal
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'COLLECTOR'>('COLLECTOR');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // 3. Status Toggle Confirm
  const [togglingUser, setTogglingUser] = useState<UserRow | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // 4. Cancel Authorization Modal State
  const [cancellingUser, setCancellingUser] = useState<UserRow | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState('Administrative transfer / End of duty');
  const [isCancelling, setIsCancelling] = useState(false);

  // 5. Delete Recruited Collector Confirm
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 6. View & Print Official Collector ID Card
  const [viewingBadgeUser, setViewingBadgeUser] = useState<UserRow | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // 7. Reset Password Modal
  const [resettingUser, setResettingUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // 8. Force 2FA Modal
  const [forcing2faUser, setForcing2faUser] = useState<UserRow | null>(null);
  const [isSubmitting2fa, setIsSubmitting2fa] = useState(false);

  const DEFAULT_USERS: UserRow[] = [
    {
      id: 'u-1',
      collectorId: 'ADM-SYS-0001',
      name: 'Super Administrator',
      email: 'admin@park.gov.in',
      phone: '9845011111',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      has2FA: true,
      lastLoginAt: 'Today, 08:30 AM',
      createdAt: '01 Jan 2026',
    },
    {
      id: 'u-2',
      collectorId: 'ADM-HQ-0002',
      name: 'Priya Sundaram',
      email: 'priya.s@park.gov.in',
      phone: '9845022222',
      role: 'ADMIN',
      status: 'ACTIVE',
      has2FA: true,
      lastLoginAt: 'Yesterday, 04:15 PM',
      createdAt: '15 Feb 2026',
    },
    {
      id: 'u-3',
      collectorId: 'COL-G2-0103',
      name: 'Ramesh Patel (Gate 2)',
      email: 'ramesh.p@park.gov.in',
      phone: '9845033333',
      role: 'COLLECTOR',
      status: 'ACTIVE',
      has2FA: false,
      assignedGate: 'G2',
      shift: 'MORNING',
      lastLoginAt: 'Today, 06:00 AM',
      createdAt: '01 Mar 2026',
    },
    {
      id: 'u-4',
      collectorId: 'COL-GS-0104',
      name: 'Suresh Kumar (Gate South)',
      email: 'suresh.k@park.gov.in',
      phone: '9845044444',
      role: 'COLLECTOR',
      status: 'DISABLED',
      has2FA: false,
      assignedGate: 'GS',
      shift: 'GENERAL',
      lastLoginAt: '20 Sep 2026',
      createdAt: '10 Mar 2026',
    },
  ];

  const fetchUsers = useCallback(async () => {
    // 1. Load recruited collectors from persistent store
    const recruited = getRecruitedCollectors();
    const recruitedRows: UserRow[] = recruited.map((c) => ({
      id: c.id,
      collectorId: c.collectorId || generateCollectorId(c.assignedGate || c.gate || 'G2'),
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: 'COLLECTOR',
      status: c.status,
      has2FA: false,
      lastLoginAt: c.status === 'CANCELLED' ? 'Authorization Cancelled' : 'Active on Gate Counter',
      createdAt: new Date(c.createdAt).toLocaleDateString('en-GB'),
      assignedGate: c.assignedGate || c.gate,
      shift: c.shift,
      isRecruited: true,
      cancelledAt: c.cancelledAt,
      cancelReason: c.cancelReason,
    }));

    if (!apiClient) {
      // Merge recruited collectors on top of default users
      const seen = new Set<string>();
      const combined: UserRow[] = [];
      for (const r of recruitedRows) {
        seen.add(r.email.toLowerCase());
        combined.push(r);
      }
      for (const d of DEFAULT_USERS) {
        if (!seen.has(d.email.toLowerCase())) {
          seen.add(d.email.toLowerCase());
          combined.push(d);
        }
      }
      setUsers(combined);
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.admin.listUsers({
        role: selectedRole !== 'ALL' && selectedRole !== 'RECRUITED' ? (selectedRole as UserRole) : undefined,
        limit: 100,
      });

      if (res && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map((raw) => {
          const u = raw as Record<string, unknown>;
          return {
            id: String(u.id || ''),
            collectorId: String(u.collectorId || `STF-${String(u.id || '').slice(-4).toUpperCase()}`),
            name: String(u.name || ''),
            email: String(u.email || ''),
            phone: String(u.phone || ''),
            role: (u.role as 'SUPER_ADMIN' | 'ADMIN' | 'COLLECTOR') || 'COLLECTOR',
            status: (u.status as 'ACTIVE' | 'DISABLED' | 'CANCELLED') || 'ACTIVE',
            has2FA: !!u.has2FA,
            lastLoginAt: u.lastLoginAt
              ? new Date(String(u.lastLoginAt)).toLocaleString('en-GB')
              : 'Never',
            createdAt: u.createdAt ? new Date(String(u.createdAt)).toLocaleDateString('en-GB') : '',
          };
        });

        // Merge recruited collectors first
        const seen = new Set<string>();
        const combined: UserRow[] = [];
        for (const r of recruitedRows) {
          seen.add(r.email.toLowerCase());
          combined.push(r);
        }
        for (const u of mapped) {
          if (!seen.has(u.email.toLowerCase())) {
            seen.add(u.email.toLowerCase());
            combined.push(u);
          }
        }
        setUsers(combined);
      } else {
        const seen = new Set<string>();
        const combined: UserRow[] = [];
        for (const r of recruitedRows) {
          seen.add(r.email.toLowerCase());
          combined.push(r);
        }
        for (const d of DEFAULT_USERS) {
          if (!seen.has(d.email.toLowerCase())) {
            seen.add(d.email.toLowerCase());
            combined.push(d);
          }
        }
        setUsers(combined);
      }
    } catch {
      const seen = new Set<string>();
      const combined: UserRow[] = [];
      for (const r of recruitedRows) {
        seen.add(r.email.toLowerCase());
        combined.push(r);
      }
      for (const d of DEFAULT_USERS) {
        if (!seen.has(d.email.toLowerCase())) {
          seen.add(d.email.toLowerCase());
          combined.push(d);
        }
      }
      setUsers(combined);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, selectedRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Listen to live recruited collectors events
  useEffect(() => {
    const handleUpdate = () => fetchUsers();
    window.addEventListener('wpd_collectors_updated', handleUpdate);
    return () => window.removeEventListener('wpd_collectors_updated', handleUpdate);
  }, [fetchUsers]);

  // When opening recruit dialog, generate unique collector ID
  const openRecruitDialog = () => {
    setRecCollectorId(generateCollectorId(recGate));
    setIsRecruitingCollector(true);
  };

  // Auto-suggest email when name or gate changes in recruit dialog
  const handleRecNameChange = (name: string) => {
    setRecName(name);
    if (!recEmail || recEmail.includes('@park.gov.in')) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (slug) {
        setRecEmail(`${slug}.${recGate.toLowerCase()}@park.gov.in`);
      }
    }
  };

  const handleRecGateChange = (gate: 'G2' | 'GS' | 'G9') => {
    setRecGate(gate);
    setRecCollectorId(generateCollectorId(gate));
    if (recName) {
      const slug = recName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (slug) {
        setRecEmail(`${slug}.${gate.toLowerCase()}@park.gov.in`);
      }
    }
  };

  // Staff Stats
  const stats = useMemo(() => {
    const total = users.length;
    const activeCollectors = users.filter((u) => u.role === 'COLLECTOR' && u.status === 'ACTIVE').length;
    const recruitedCount = users.filter((u) => u.isRecruited).length;
    const cancelledCount = users.filter((u) => u.status === 'CANCELLED').length;
    const adminCount = users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length;
    return { total, activeCollectors, recruitedCount, cancelledCount, adminCount };
  }, [users]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (selectedRole === 'RECRUITED' && !u.isRecruited) return false;
      if (selectedRole === 'CANCELLED' && u.status !== 'CANCELLED') return false;
      if (selectedRole !== 'ALL' && selectedRole !== 'RECRUITED' && selectedRole !== 'CANCELLED' && u.role !== selectedRole) {
        return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        (u.collectorId && u.collectorId.toLowerCase().includes(q)) ||
        (u.assignedGate && u.assignedGate.toLowerCase().includes(q))
      );
    });
  }, [users, selectedRole, searchQuery]);

  // Submit Collector Recruitment
  const handleRecruitCollectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recName.trim() || !recPhone.trim() || !recEmail.trim() || !recPassword) {
      addToast({
        title: 'Missing Fields',
        description: 'Please complete all required fields to authorize this collector.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingRecruit(true);
    try {
      const finalCollectorId = recCollectorId.trim().toUpperCase() || generateCollectorId(recGate);
      const newCollector: RecruitedCollector = {
        id: `col-${Date.now()}`,
        collectorId: finalCollectorId,
        name: recName.trim(),
        email: recEmail.trim().toLowerCase(),
        phone: recPhone.trim(),
        password: recPassword,
        gate: recGate,
        assignedGate: recGate,
        shift: recShift,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      saveRecruitedCollector(newCollector);

      addToast({
        title: '🎉 Collector Recruited & ID Issued',
        description: `${recName} is authorized with ID ${finalCollectorId} at Gate ${recGate}. Login is active.`,
        variant: 'success',
      });

      setIsRecruitingCollector(false);
      setRecName('');
      setRecPhone('');
      setRecEmail('');
      setRecPassword('Collector@123');
      fetchUsers();
    } catch {
      addToast({
        title: 'Recruitment Failed',
        description: 'Unable to save collector credentials.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingRecruit(false);
    }
  };

  // Submit Generic Staff User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPhone.trim() || !newPassword) return;

    setIsSubmittingCreate(true);
    try {
      if (apiClient) {
        await apiClient.admin.createUser({
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          role: newRole,
          password: newPassword,
        });
      }

      const created: UserRow = {
        id: `u-${Date.now()}`,
        collectorId: `ADM-STF-${Date.now().toString().slice(-4)}`,
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        phone: newPhone.trim(),
        role: newRole,
        status: 'ACTIVE',
        has2FA: false,
        createdAt: 'Just now',
      };

      setUsers((prev) => [created, ...prev]);

      addToast({
        title: 'Staff User Created',
        description: `Account created for ${newName} as ${newRole}.`,
        variant: 'success',
      });

      setIsCreatingUser(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      addToast({ title: 'Creation Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Cancel Collector Authorization
  const handleConfirmCancelCollector = () => {
    if (!cancellingUser) return;
    setIsCancelling(true);
    try {
      cancelRecruitedCollector(cancellingUser.id, cancelReasonText.trim());
      setUsers((prev) =>
        prev.map((u) =>
          u.id === cancellingUser.id
            ? {
                ...u,
                status: 'CANCELLED',
                cancelReason: cancelReasonText.trim(),
                cancelledAt: new Date().toISOString(),
              }
            : u
        )
      );

      addToast({
        title: 'Collector Authorization Cancelled',
        description: `${cancellingUser.name} (${cancellingUser.collectorId || 'ID'}) has been revoked and can no longer sign in.`,
        variant: 'destructive',
      });
      setCancellingUser(null);
    } catch {
      addToast({
        title: 'Cancellation Failed',
        description: 'Unable to revoke collector authorization.',
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle Status Toggle (ACTIVE <-> DISABLED)
  const handleToggleStatus = async () => {
    if (!togglingUser) return;
    const nextStatus = togglingUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

    setIsTogglingStatus(true);
    try {
      if (togglingUser.isRecruited) {
        toggleRecruitedCollectorStatus(togglingUser.id);
      } else if (apiClient) {
        await apiClient.admin.updateUserStatus(togglingUser.id, {
          status: nextStatus === 'ACTIVE' ? 'ACTIVE' : 'DISABLED',
          reason: `Admin changed status to ${nextStatus}`,
        });
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === togglingUser.id ? { ...u, status: nextStatus } : u))
      );

      addToast({
        title: `Account ${nextStatus === 'ACTIVE' ? 'Activated' : 'Suspended'}`,
        description: `${togglingUser.name}'s gate desk access is now ${nextStatus}.`,
        variant: 'default',
      });
      setTogglingUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      addToast({ title: 'Update Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Handle Delete Recruited Collector
  const handleDeleteCollector = () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      if (deletingUser.isRecruited) {
        deleteRecruitedCollector(deletingUser.id);
      }
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      addToast({
        title: 'Collector Removed',
        description: `${deletingUser.name} has been removed from the gate roster.`,
        variant: 'default',
      });
      setDeletingUser(null);
    } catch {
      addToast({
        title: 'Delete Failed',
        description: 'Could not remove collector from system.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Admin Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !resetPassword) return;

    setIsSubmittingReset(true);
    try {
      if (resettingUser.isRecruited) {
        const recruited = getRecruitedCollectors();
        const found = recruited.find((c) => c.id === resettingUser.id);
        if (found) {
          saveRecruitedCollector({
            ...found,
            password: resetPassword,
          });
        }
      } else if (apiClient) {
        await apiClient.admin.resetUserPassword(resettingUser.id, {
          newPassword: resetPassword,
        });
      }

      addToast({
        title: 'Password Updated',
        description: `New password saved for ${resettingUser.name}. They can now login with this password.`,
        variant: 'success',
      });

      setResettingUser(null);
      setResetPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset password failed';
      addToast({ title: 'Reset Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Handle Force 2FA
  const handleForce2fa = async (require2fa: boolean) => {
    if (!forcing2faUser) return;

    setIsSubmitting2fa(true);
    try {
      if (apiClient) {
        await apiClient.admin.force2fa(forcing2faUser.id, { require2fa });
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === forcing2faUser.id ? { ...u, has2FA: require2fa } : u
        )
      );

      addToast({
        title: require2fa ? '2FA Enforced' : '2FA Credentials Reset',
        description: require2fa
          ? `2FA is now required for ${forcing2faUser.name}.`
          : `2FA reset. ${forcing2faUser.name} will re-enroll upon login.`,
        variant: 'default',
      });

      setForcing2faUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '2FA update failed';
      addToast({ title: 'Update Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting2fa(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    addToast({ title: 'Copied to Clipboard', description: text, variant: 'default' });
  };

  const columns: ColumnDef<UserRow>[] = [
    {
      header: 'Collector / Staff & ID',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-slate-100">{row.name}</span>
            {row.isRecruited && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Sparkles className="w-2.5 h-2.5" /> RECRUITED
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {row.collectorId && (
              <span className="font-mono font-extrabold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                ID: {row.collectorId}
              </span>
            )}
            <span className="text-slate-500 font-mono text-[11px]">{row.email}</span>
          </div>
          <div className="flex items-center gap-2">
            {row.assignedGate && (
              <span className="inline-flex items-center gap-1 font-sans font-bold text-[11px] text-park-800 dark:text-park-300 bg-park-100 dark:bg-park-950/80 px-2 py-0.5 rounded-md">
                <MapPin className="w-3 h-3 text-park-600" /> Gate {row.assignedGate}
              </span>
            )}
            {row.shift && (
              <span className="inline-flex items-center gap-1 font-sans text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                <Clock className="w-3 h-3" /> {row.shift}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Phone Number',
      accessorKey: 'phone',
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.phone}</span>,
    },
    {
      header: 'Role',
      accessorKey: 'role',
      sortable: true,
      cell: (row) => {
        if (row.role === 'SUPER_ADMIN') {
          return (
            <Badge variant="default" className="bg-purple-900 text-purple-100 dark:bg-purple-950 dark:text-purple-300">
              SUPER ADMIN
            </Badge>
          );
        }
        if (row.role === 'ADMIN') {
          return (
            <Badge variant="default" className="bg-park-800 text-park-100">
              ADMIN
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-slate-300 text-slate-700 dark:text-slate-300 font-bold">
            COLLECTOR
          </Badge>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => {
        if (row.status === 'CANCELLED') {
          return (
            <Badge variant="destructive" className="flex items-center gap-1 w-fit font-bold bg-rose-600 text-white">
              <Ban className="w-3 h-3" /> Cancelled
            </Badge>
          );
        }
        if (row.status === 'DISABLED') {
          return (
            <Badge variant="destructive" className="flex items-center gap-1 w-fit font-bold">
              <XCircle className="w-3 h-3" /> Suspended
            </Badge>
          );
        }
        return (
          <Badge variant="success" className="flex items-center gap-1 w-fit font-bold">
            <CheckCircle2 className="w-3 h-3" /> Active
          </Badge>
        );
      },
    },
    {
      header: 'ID Badge & Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          {/* 1. Official ID Badge Viewer / Print Button */}
          {row.role === 'COLLECTOR' && (
            <Button
              size="sm"
              variant="outline"
              title="View & Print Official Collector ID Badge"
              className="h-8 px-2.5 text-xs font-bold text-park-900 dark:text-park-200 border-park-300 dark:border-park-700 bg-park-50 dark:bg-park-950/60 hover:bg-park-100 flex items-center gap-1"
              onClick={() => setViewingBadgeUser(row)}
            >
              <CreditCard className="w-3.5 h-3.5 text-park-700" />
              <span>ID Card</span>
            </Button>
          )}

          {/* 2. Reset Password */}
          <Button
            size="sm"
            variant="ghost"
            title="Reset Password"
            className="hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              setResettingUser(row);
              setResetPassword('');
            }}
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          </Button>

          {/* 3. Cancel Collector Authorization */}
          {row.role === 'COLLECTOR' && row.status !== 'CANCELLED' && (
            <Button
              size="sm"
              variant="ghost"
              title="Cancel Collector Authorization"
              className="hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/50"
              onClick={() => {
                setCancellingUser(row);
                setCancelReasonText('Administrative transfer / Duty concluded');
              }}
            >
              <Ban className="w-3.5 h-3.5 text-rose-600" />
            </Button>
          )}

          {/* 4. Suspend / Activate Toggle */}
          {row.status !== 'CANCELLED' && (
            <Button
              size="sm"
              variant="ghost"
              title={row.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
              className="hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setTogglingUser(row)}
            >
              {row.status === 'ACTIVE' ? (
                <XCircle className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </Button>
          )}

          {/* 5. Delete Collector */}
          {row.isRecruited && (
            <Button
              size="sm"
              variant="ghost"
              title="Permanently Remove Collector"
              className="hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/50"
              onClick={() => setDeletingUser(row)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Collector Recruitment Banner / Hero */}
      <div className="bg-gradient-to-r from-emerald-900 via-park-950 to-slate-900 text-white p-5 rounded-3xl shadow-lg border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Sparkles className="w-3 h-3 text-emerald-400" /> Gate Staffing & ID Issuer
          </div>
          <h2 className="text-xl font-black tracking-tight">Recruit Collectors & Issue Gate IDs</h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Authorize new field agents with unique Collector IDs, allocate gate counters (`G2`, `GS`, `G9`), generate printable identity badges, and manage or cancel authorizations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            onClick={openRecruitDialog}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black shadow-lg h-11 px-5 rounded-2xl flex items-center gap-2 active:scale-95 transition"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Recruit Gate Collector</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCreatingUser(true)}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs h-11 px-4 rounded-2xl"
          >
            Create Admin
          </Button>
        </div>
      </div>

      {/* 2. Staff Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Total Staff</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {stats.total}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Across all roles</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <span>Active Collectors</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {stats.activeCollectors}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">On-duty on gate counters</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-park-700 dark:text-park-400 text-xs font-bold">
            <span>Recruited Roster</span>
            <Sparkles className="w-4 h-4 text-park-500" />
          </div>
          <div className="text-2xl font-black text-park-800 dark:text-park-200 mt-1">
            {stats.recruitedCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Admin-recruited collectors</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-bold">
            <span>Cancelled IDs</span>
            <Ban className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">
            {stats.cancelledCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Revoked authorizations</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs font-bold">
            <span>Supervisors</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1">
            {stats.adminCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Audit & reports control</p>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search by name, ID (e.g. COL-G2), phone, gate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs h-10 rounded-xl"
            />
          </div>

          <div className="w-48">
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="text-xs h-10 rounded-xl"
            >
              <option value="ALL">All Staff Members</option>
              <option value="RECRUITED">Recruited Collectors Only</option>
              <option value="CANCELLED">Cancelled Authorizations</option>
              <option value="COLLECTOR">All Gate Collectors</option>
              <option value="ADMIN">Admins Only</option>
              <option value="SUPER_ADMIN">Super Admins Only</option>
            </Select>
          </div>
        </div>
      </div>

      {/* 4. Main Users Table */}
      <DataTable
        data={filteredUsers}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No staff members matching your filter."
      />

      {/* MODAL 1: Recruit Gate Collector & Generate ID */}
      {isRecruitingCollector && (
        <Dialog
          isOpen={true}
          onClose={() => setIsRecruitingCollector(false)}
          title="Recruit Collector & Create Gate ID"
          description="Issue an official Collector ID number and authorize a staff member for gate ticket issuance."
        >
          <form onSubmit={handleRecruitCollectorSubmit} className="space-y-4 mt-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Collector ID Issuance:</strong> This collector can log into the gate counter mobile app using their assigned <strong>Collector ID</strong>, <strong>Email</strong>, or <strong>Phone Number</strong>.
              </span>
            </div>

            {/* Generated Collector ID */}
            <FormItem label="Official Collector ID (Auto-Generated)" required hint="Unique identity badge identifier">
              <div className="flex gap-2">
                <Input
                  value={recCollectorId}
                  onChange={(e) => setRecCollectorId(e.target.value.toUpperCase())}
                  className="font-mono font-black text-sm uppercase tracking-wider"
                  placeholder="e.g. COL-G2-1049"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRecCollectorId(generateCollectorId(recGate))}
                  className="shrink-0 flex items-center gap-1 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </Button>
              </div>
            </FormItem>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormItem label="Assigned Park Gate" required hint="Desk location where collector operates">
                <Select
                  value={recGate}
                  onChange={(e) => handleRecGateChange(e.target.value as 'G2' | 'GS' | 'G9')}
                  className="font-bold"
                >
                  <option value="G2">Gate 2 - South Gate (Lalbagh Siddapura)</option>
                  <option value="GS">Gate South - Science Gate (Bose Gate)</option>
                  <option value="G9">Gate 9 - North Gate (Double Road)</option>
                </Select>
              </FormItem>

              <FormItem label="Shift Roster" required hint="Operational duty window">
                <Select
                  value={recShift}
                  onChange={(e) => setRecShift(e.target.value as 'MORNING' | 'GENERAL' | 'EVENING')}
                  className="font-bold"
                >
                  <option value="MORNING">Morning Shift (05:30 AM - 10:00 AM)</option>
                  <option value="GENERAL">General Shift (05:30 AM - 07:30 PM)</option>
                  <option value="EVENING">Evening Shift (04:00 PM - 07:30 PM)</option>
                </Select>
              </FormItem>
            </div>

            <FormItem label="Collector Full Name" required hint="As printed on government photo ID">
              <Input
                placeholder="e.g. Ramesh Patel"
                value={recName}
                onChange={(e) => handleRecNameChange(e.target.value)}
                required
              />
            </FormItem>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormItem label="Mobile Phone Number" required hint="10-digit phone for SMS & login">
                <Input
                  type="tel"
                  placeholder="e.g. 9845012345"
                  value={recPhone}
                  onChange={(e) => setRecPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  required
                />
              </FormItem>

              <FormItem label="Login Email / Username" required hint="Auto-generated or official">
                <Input
                  type="email"
                  placeholder="e.g. ramesh.g2@park.gov.in"
                  value={recEmail}
                  onChange={(e) => setRecEmail(e.target.value)}
                  required
                />
              </FormItem>
            </div>

            <FormItem
              label="Gate Desk Login Password"
              required
              hint="Collector enters this password at the gate tablet / mobile login screen"
            >
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Collector@123"
                  value={recPassword}
                  onChange={(e) => setRecPassword(e.target.value)}
                  className="pl-9 font-mono"
                  required
                />
              </div>
            </FormItem>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRecruitingCollector(false)}
                disabled={isSubmittingRecruit}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isSubmittingRecruit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5"
              >
                Authorize & Issue ID Card
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* MODAL 2: Official Collector ID Badge Viewer & Print */}
      {viewingBadgeUser && (
        <Dialog
          isOpen={true}
          onClose={() => setViewingBadgeUser(null)}
          title="Collector Identity Card & Gate Pass Badge"
          description="Official Government of Karnataka Horticulture & Park Field Authorization Card"
        >
          <div className="space-y-4 mt-2">
            {/* Laminated Identity Badge Card */}
            <div
              id="collector-id-badge"
              className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white p-5 rounded-3xl border-2 border-emerald-500/40 shadow-2xl relative overflow-hidden"
            >
              {/* Badge Background Watermark */}
              <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
                <QrCode className="w-48 h-48 text-white" />
              </div>

              {/* Top Header */}
              <div className="flex items-center justify-between border-b border-emerald-700/50 pb-3">
                <div>
                  <div className="text-[10px] tracking-widest uppercase font-extrabold text-emerald-400">
                    Govt. of Karnataka • Dept. of Horticulture
                  </div>
                  <div className="text-sm font-black tracking-tight mt-0.5">
                    Lalbagh Botanical Garden • Pass Desk
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500 text-emerald-950">
                    Authorized
                  </span>
                </div>
              </div>

              {/* Badge Body */}
              <div className="py-4 flex gap-4 items-center">
                <div className="w-20 h-24 rounded-2xl bg-emerald-900/60 border-2 border-emerald-400/50 flex flex-col items-center justify-center text-center p-2 shrink-0">
                  <div className="w-12 h-12 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center font-black text-xl mb-1">
                    {viewingBadgeUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[9px] uppercase font-bold text-emerald-300">Staff</span>
                </div>

                <div className="space-y-1 min-w-0">
                  <h3 className="text-lg font-black truncate text-white leading-tight">
                    {viewingBadgeUser.name}
                  </h3>
                  <div className="text-xs text-emerald-300 font-semibold">
                    Gate Desk Officer • {viewingBadgeUser.role}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-mono text-xs font-black bg-emerald-400/20 border border-emerald-400/40 text-emerald-200 px-2 py-0.5 rounded-md">
                      {viewingBadgeUser.collectorId || 'COL-ID'}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(viewingBadgeUser.collectorId || '')}
                      className="p-1 hover:bg-emerald-800/50 rounded text-emerald-300 transition"
                      title="Copy Collector ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Duty Details Footer */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-emerald-700/50 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Gate</span>
                  <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    Gate {viewingBadgeUser.assignedGate || 'G2'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Duty Shift</span>
                  <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-amber-400" />
                    {viewingBadgeUser.shift || 'General'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Official Contact</span>
                  <span className="font-mono text-slate-300">{viewingBadgeUser.phone}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Issued Date</span>
                  <span className="font-mono text-slate-300">{viewingBadgeUser.createdAt}</span>
                </div>
              </div>
            </div>

            {/* Print & Action Buttons */}
            <div className="flex justify-between items-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewingBadgeUser(null)}
              >
                Close
              </Button>

              <Button
                type="button"
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Official Badge
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* MODAL 3: Cancel Collector Authorization Dialog */}
      {cancellingUser && (
        <Dialog
          isOpen={true}
          onClose={() => setCancellingUser(null)}
          title={`Cancel Authorization: ${cancellingUser.name}`}
          description={`Revoke gate pass issuance rights for Collector ID: ${cancellingUser.collectorId || cancellingUser.id}.`}
        >
          <div className="space-y-4 mt-2">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
              <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                <strong>Immediate Revocation:</strong> Cancelling this collector will invalidate their identity badge and immediately prevent them from logging in at gate counters.
              </span>
            </div>

            <FormItem label="Reason for Cancellation" required hint="Recorded in administrative audit register">
              <Textarea
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                placeholder="e.g. Relieved from duty, transferred to different branch, pass discrepancy"
                rows={3}
                required
              />
            </FormItem>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancellingUser(null)}
                disabled={isCancelling}
              >
                Keep Active
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmCancelCollector}
                isLoading={isCancelling}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Revoke & Cancel Authorization
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* MODAL 4: Create Admin / Generic Staff User */}
      {isCreatingUser && (
        <Dialog
          isOpen={true}
          onClose={() => setIsCreatingUser(false)}
          title="Create System Administrator"
          description="Register an administrative supervisor with audit and configuration permissions."
        >
          <form onSubmit={handleCreateUser} className="space-y-4 mt-2">
            <FormItem label="Full Name" required>
              <Input
                placeholder="e.g. Dr. H. Ananth"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </FormItem>

            <FormItem label="Email Address" required>
              <Input
                type="email"
                placeholder="e.g. ananth@park.gov.in"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </FormItem>

            <FormItem label="Phone Number" required hint="10-digit Indian mobile number">
              <Input
                placeholder="e.g. 9845099999"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
            </FormItem>

            <FormItem label="Role" required>
              <Select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'ADMIN' | 'COLLECTOR')}
              >
                <option value="ADMIN">ADMIN (Full management & reports access)</option>
                <option value="COLLECTOR">COLLECTOR (Gate desk pass registration)</option>
              </Select>
            </FormItem>

            <FormItem
              label="Temporary Password"
              required
              hint="Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character"
            >
              <Input
                type="password"
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </FormItem>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreatingUser(false)}
                disabled={isSubmittingCreate}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmittingCreate}>
                Create Staff User
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* MODAL 5: Suspend / Activate Confirm Dialog */}
      {togglingUser && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setTogglingUser(null)}
          onConfirm={handleToggleStatus}
          title={
            togglingUser.status === 'ACTIVE'
              ? `Suspend Account: ${togglingUser.name}`
              : `Activate Account: ${togglingUser.name}`
          }
          description={
            togglingUser.status === 'ACTIVE'
              ? `Are you sure you want to suspend ${togglingUser.name}? They will not be able to log into gate desks until re-activated.`
              : `Restore gate desk access for ${togglingUser.name}?`
          }
          confirmText={togglingUser.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
          variant={togglingUser.status === 'ACTIVE' ? 'destructive' : 'default'}
          isLoading={isTogglingStatus}
        />
      )}

      {/* MODAL 6: Delete Recruited Collector Confirm Dialog */}
      {deletingUser && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleDeleteCollector}
          title={`Remove Collector: ${deletingUser.name}`}
          description={`Are you sure you want to completely remove ${deletingUser.name} from the gate roster? All assigned credentials will be wiped.`}
          confirmText="Delete Collector"
          variant="destructive"
          isLoading={isDeleting}
        />
      )}

      {/* MODAL 7: Reset Password Modal */}
      {resettingUser && (
        <Dialog
          isOpen={true}
          onClose={() => setResettingUser(null)}
          title={`Reset Password: ${resettingUser.name}`}
          description="Set a new password for this staff account."
        >
          <form onSubmit={handleResetPassword} className="space-y-4 mt-2">
            <FormItem
              label="New Password"
              required
              hint="Provide a secure password for login"
            >
              <Input
                type="text"
                placeholder="Enter new password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
              />
            </FormItem>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResettingUser(null)}
                disabled={isSubmittingReset}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmittingReset}>
                Update Password
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* MODAL 8: Force 2FA Dialog */}
      {forcing2faUser && (
        <Dialog
          isOpen={true}
          onClose={() => setForcing2faUser(null)}
          title={`Two-Factor Authentication: ${forcing2faUser.name}`}
          description={`Manage TOTP 2FA requirements for ${forcing2faUser.email}.`}
        >
          <div className="space-y-4 mt-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {forcing2faUser.has2FA
                ? 'This user currently has 2FA configured. You can reset their TOTP secret so they must set up a new authenticator app on their next login.'
                : 'Enforce mandatory 2FA enrollment for this user. They will be prompted with a QR code on their next sign-in.'}
            </p>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setForcing2faUser(null)}
                disabled={isSubmitting2fa}
              >
                Cancel
              </Button>
              {forcing2faUser.has2FA ? (
                <Button
                  variant="destructive"
                  onClick={() => handleForce2fa(false)}
                  isLoading={isSubmitting2fa}
                >
                  Reset 2FA Secret
                </Button>
              ) : (
                <Button
                  onClick={() => handleForce2fa(true)}
                  isLoading={isSubmitting2fa}
                >
                  Enforce 2FA
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
