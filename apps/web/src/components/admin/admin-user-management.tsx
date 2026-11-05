'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient, UserRole } from '@wpd/shared';
import { DataTable, ColumnDef } from '../ui/data-table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { FormItem, Input, Select } from '../ui/form-controls';
import { useToast } from '../ui/toast';
import {
  getRecruitedCollectors,
  saveRecruitedCollector,
  toggleRecruitedCollectorStatus,
  deleteRecruitedCollector,
  RecruitedCollector,
} from '../../lib/pass-store';
import {
  UserPlus,
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Sparkles,
  Users,
  Trash2,
  Lock,
} from 'lucide-react';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'COLLECTOR';
  status: 'ACTIVE' | 'DISABLED';
  has2FA: boolean;
  failedLogins?: number;
  lastLoginAt?: string | null;
  createdAt: string;
  assignedGate?: string;
  shift?: string;
  isRecruited?: boolean;
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

  // 4. Delete Recruited Collector Confirm
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 5. Reset Password Modal
  const [resettingUser, setResettingUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // 6. Force 2FA Modal
  const [forcing2faUser, setForcing2faUser] = useState<UserRow | null>(null);
  const [isSubmitting2fa, setIsSubmitting2fa] = useState(false);

  const DEFAULT_USERS: UserRow[] = [
    {
      id: 'u-1',
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
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: 'COLLECTOR',
      status: c.status,
      has2FA: false,
      lastLoginAt: 'Active on Gate Counter',
      createdAt: new Date(c.createdAt).toLocaleDateString('en-GB'),
      assignedGate: c.assignedGate || c.gate,
      shift: c.shift,
      isRecruited: true,
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
            name: String(u.name || ''),
            email: String(u.email || ''),
            phone: String(u.phone || ''),
            role: (u.role as 'SUPER_ADMIN' | 'ADMIN' | 'COLLECTOR') || 'COLLECTOR',
            status: (u.status as 'ACTIVE' | 'DISABLED') || 'ACTIVE',
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
    const adminCount = users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length;
    return { total, activeCollectors, recruitedCount, adminCount };
  }, [users]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (selectedRole === 'RECRUITED' && !u.isRecruited) return false;
      if (selectedRole !== 'ALL' && selectedRole !== 'RECRUITED' && u.role !== selectedRole) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
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
      const newCollector: RecruitedCollector = {
        id: `col-${Date.now()}`,
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
        title: '🎉 Gate Collector Recruited',
        description: `${recName} is now fully authorized at Gate ${recGate} (${recShift} Shift). Login credentials active immediately.`,
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

  // Handle Status Toggle (ACTIVE <-> DISABLED)
  const handleToggleStatus = async () => {
    if (!togglingUser) return;
    const nextStatus = togglingUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

    setIsTogglingStatus(true);
    try {
      // Check if user is a recruited collector
      if (togglingUser.isRecruited) {
        toggleRecruitedCollectorStatus(togglingUser.id);
      } else if (apiClient) {
        await apiClient.admin.updateUserStatus(togglingUser.id, {
          status: nextStatus,
          reason: `Admin changed status to ${nextStatus}`,
        });
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === togglingUser.id ? { ...u, status: nextStatus } : u)),
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
          u.id === forcing2faUser.id ? { ...u, has2FA: require2fa } : u,
        ),
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

  const columns: ColumnDef<UserRow>[] = [
    {
      header: 'Staff Member & Gate',
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
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>{row.email}</span>
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
      header: 'Phone',
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
        return row.status === 'ACTIVE' ? (
          <Badge variant="success" className="flex items-center gap-1 w-fit font-bold">
            <CheckCircle2 className="w-3 h-3" /> Active
          </Badge>
        ) : (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit font-bold">
            <XCircle className="w-3 h-3" /> Suspended
          </Badge>
        );
      },
    },
    {
      header: 'Security',
      cell: (row) => {
        return row.has2FA ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> 2FA Enforced
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5" /> Pass Protected
          </span>
        );
      },
    },
    {
      header: 'Last Active',
      accessorKey: 'lastLoginAt',
      cell: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.lastLoginAt || 'Ready for Login'}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
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

          {!row.isRecruited && (
            <Button
              size="sm"
              variant="ghost"
              title={row.has2FA ? 'Reset 2FA Configuration' : 'Force 2FA'}
              className="hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setForcing2faUser(row)}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-park-700 dark:text-park-400" />
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            title={row.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
            className="hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setTogglingUser(row)}
          >
            {row.status === 'ACTIVE' ? (
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
          </Button>

          {row.isRecruited && (
            <Button
              size="sm"
              variant="ghost"
              title="Remove Recruited Collector"
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
      <div className="bg-gradient-to-r from-emerald-900 via-park-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Sparkles className="w-3 h-3 text-emerald-400" /> Gate Staffing Power
          </div>
          <h2 className="text-xl font-black tracking-tight">Recruit Gate Collectors</h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Authorize new field agents to issue 30-day physical walker passes, handle ₹200 cash & UPI collections, and conduct shift handovers at designated gate desks.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            onClick={() => setIsRecruitingCollector(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black shadow-lg h-11 px-5 rounded-xl flex items-center gap-2 active:scale-95 transition"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Recruit Gate Collector</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCreatingUser(true)}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs h-11 px-4 rounded-xl"
          >
            Create Admin
          </Button>
        </div>
      </div>

      {/* 2. Staff Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          <p className="text-[11px] text-slate-500 mt-0.5">Authorized for pass counters</p>
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
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs font-bold">
            <span>Supervisors & Admins</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1">
            {stats.adminCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Full audit & report access</p>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search staff, email, phone, gate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs h-10 rounded-xl"
            />
          </div>

          <div className="w-44">
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="text-xs h-10 rounded-xl"
            >
              <option value="ALL">All Staff Members</option>
              <option value="RECRUITED">Recruited Collectors Only</option>
              <option value="COLLECTOR">All Gate Collectors</option>
              <option value="ADMIN">Admins</option>
              <option value="SUPER_ADMIN">Super Admins</option>
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

      {/* MODAL 1: Recruit Gate Collector (The core power requested by client) */}
      {isRecruitingCollector && (
        <Dialog
          isOpen={true}
          onClose={() => setIsRecruitingCollector(false)}
          title="Recruit New Gate Collector"
          description="Grant gate desk authorization to a new staff member. They will be immediately able to log into the mobile collector app."
        >
          <form onSubmit={handleRecruitCollectorSubmit} className="space-y-4 mt-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Instant Gate Activation:</strong> This account will be saved to the park gate credential store. The collector can immediately sign in with their phone number or email and assigned password.
              </span>
            </div>

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

            <FormItem label="Collector Full Name" required hint="As printed on government ID">
              <Input
                placeholder="e.g. Ramesh Patel"
                value={recName}
                onChange={(e) => handleRecNameChange(e.target.value)}
                required
              />
            </FormItem>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormItem label="Mobile Phone Number" required hint="Used for SMS & login identification">
                <Input
                  type="tel"
                  placeholder="e.g. 9845012345"
                  value={recPhone}
                  onChange={(e) => setRecPhone(e.target.value)}
                  maxLength={10}
                  required
                />
              </FormItem>

              <FormItem label="Login Email / Username" required hint="Auto-generated or custom">
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
                Authorize & Recruit Collector
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* MODAL 2: Create Admin / Generic Staff Member */}
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
                onChange={(e) => setNewPhone(e.target.value)}
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

      {/* MODAL 3: Toggle Status Confirm Dialog */}
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
              ? `Are you sure you want to suspend ${togglingUser.name}? They will not be able to log into gate desks or register passes until re-activated.`
              : `Restore gate desk access for ${togglingUser.name}?`
          }
          confirmText={togglingUser.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
          variant={togglingUser.status === 'ACTIVE' ? 'destructive' : 'default'}
          isLoading={isTogglingStatus}
        />
      )}

      {/* MODAL 4: Delete Recruited Collector Confirm Dialog */}
      {deletingUser && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleDeleteCollector}
          title={`Remove Collector: ${deletingUser.name}`}
          description={`Are you sure you want to completely remove ${deletingUser.name} from the gate roster? Their credentials will be deleted.`}
          confirmText="Delete Collector"
          variant="destructive"
          isLoading={isDeleting}
        />
      )}

      {/* MODAL 5: Reset Password Modal */}
      {resettingUser && (
        <Dialog
          isOpen={true}
          onClose={() => setResettingUser(null)}
          title={`Reset Password: ${resettingUser.name}`}
          description="Set a new password for this user's account."
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

      {/* MODAL 6: Force 2FA Dialog */}
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
                : 'Enforce mandatory 2FA enrollment for this user. They will be prompted with a QR code and backup codes on their next sign-in.'}
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
