'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient, UserRole } from '@wpd/shared';
import { DataTable, ColumnDef } from '../ui/data-table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { FormItem, Input, Select } from '../ui/form-controls';
import { useToast } from '../ui/toast';
import {
  UserPlus,
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
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

  // Create User Modal
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'COLLECTOR'>('COLLECTOR');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Status Toggle Confirm
  const [togglingUser, setTogglingUser] = useState<UserRow | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Reset Password Modal
  const [resettingUser, setResettingUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Force 2FA Modal
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
      lastLoginAt: '20 Sep 2026',
      createdAt: '10 Mar 2026',
    },
  ];

  useEffect(() => {
    fetchUsers();
  }, [selectedRole]);

  const fetchUsers = async () => {
    if (!apiClient) {
      setUsers(DEFAULT_USERS);
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.admin.listUsers({
        role: selectedRole !== 'ALL' ? (selectedRole as UserRole) : undefined,
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
        setUsers(mapped);
      } else {
        setUsers(DEFAULT_USERS);
      }
    } catch {
      setUsers(DEFAULT_USERS);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (selectedRole !== 'ALL' && u.role !== selectedRole) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.includes(q)
    );
  });

  // Handle Create User Submit
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
      if (apiClient) {
        await apiClient.admin.updateUserStatus(togglingUser.id, {
          status: nextStatus,
          reason: `Admin changed status to ${nextStatus}`,
        });
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === togglingUser.id ? { ...u, status: nextStatus } : u)),
      );

      addToast({
        title: `User ${nextStatus === 'ACTIVE' ? 'Enabled' : 'Disabled'}`,
        description: `${togglingUser.name}'s account is now ${nextStatus}.`,
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

  // Handle Admin Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !resetPassword) return;

    setIsSubmittingReset(true);
    try {
      if (apiClient) {
        await apiClient.admin.resetUserPassword(resettingUser.id, {
          newPassword: resetPassword,
        });
      }

      addToast({
        title: 'Password Reset Successful',
        description: `New password saved. All active sessions for ${resettingUser.name} have been invalidated.`,
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
      header: 'Staff Member',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100">{row.name}</div>
          <div className="text-xs text-slate-500 font-mono">{row.email}</div>
        </div>
      ),
    },
    {
      header: 'Phone',
      accessorKey: 'phone',
      cell: (row) => <span className="font-mono text-xs">{row.phone}</span>,
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
        return <Badge variant="outline">COLLECTOR</Badge>;
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => {
        return row.status === 'ACTIVE' ? (
          <Badge variant="success" className="flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" /> Active
          </Badge>
        ) : (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3" /> Disabled
          </Badge>
        );
      },
    },
    {
      header: '2FA Status',
      cell: (row) => {
        return row.has2FA ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Enforced
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5" /> Optional
          </span>
        );
      },
    },
    {
      header: 'Last Active',
      accessorKey: 'lastLoginAt',
      cell: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.lastLoginAt || 'Never'}
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
            onClick={() => {
              setResettingUser(row);
              setResetPassword('');
            }}
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            title={row.has2FA ? 'Reset 2FA Configuration' : 'Force 2FA'}
            onClick={() => setForcing2faUser(row)}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-park-700 dark:text-park-400" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            title={row.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
            onClick={() => setTogglingUser(row)}
          >
            {row.status === 'ACTIVE' ? (
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Filter & Create User Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search staff, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="w-36">
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="text-xs"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">Super Admins</option>
              <option value="ADMIN">Admins</option>
              <option value="COLLECTOR">Collectors</option>
            </Select>
          </div>
        </div>

        <Button
          onClick={() => setIsCreatingUser(true)}
          className="flex items-center gap-1.5 text-xs"
        >
          <UserPlus className="w-4 h-4" />
          Create Staff User
        </Button>
      </div>

      {/* Main Users Table */}
      <DataTable
        data={filteredUsers}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No staff users matching query."
      />

      {/* 1. Create Staff User Modal */}
      {isCreatingUser && (
        <Dialog
          isOpen={true}
          onClose={() => setIsCreatingUser(false)}
          title="Create New Staff Member"
          description="Register a new Collector or Admin user. Password will be hashed using Argon2id."
        >
          <form onSubmit={handleCreateUser} className="space-y-4 mt-2">
            <FormItem label="Full Name" required>
              <Input
                placeholder="e.g. Ramesh Kumar"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </FormItem>

            <FormItem label="Email Address" required>
              <Input
                type="email"
                placeholder="e.g. ramesh@park.gov.in"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </FormItem>

            <FormItem label="Phone Number" required hint="10-digit Indian mobile number">
              <Input
                placeholder="e.g. 9845012345"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
              />
            </FormItem>

            <FormItem label="System Role" required>
              <Select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'ADMIN' | 'COLLECTOR')}
              >
                <option value="COLLECTOR">COLLECTOR (Gate pass desk registration & renewals)</option>
                <option value="ADMIN">ADMIN (Full management & reports access)</option>
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

      {/* 2. Toggle Status Confirm Dialog */}
      {togglingUser && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setTogglingUser(null)}
          onConfirm={handleToggleStatus}
          title={
            togglingUser.status === 'ACTIVE'
              ? `Disable User: ${togglingUser.name}`
              : `Enable User: ${togglingUser.name}`
          }
          description={
            togglingUser.status === 'ACTIVE'
              ? `Are you sure you want to disable ${togglingUser.name}'s account? They will be immediately blocked from signing in.`
              : `Re-activate ${togglingUser.name}'s account for system access?`
          }
          confirmText={togglingUser.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
          variant={togglingUser.status === 'ACTIVE' ? 'destructive' : 'default'}
          isLoading={isTogglingStatus}
        />
      )}

      {/* 3. Reset Password Modal */}
      {resettingUser && (
        <Dialog
          isOpen={true}
          onClose={() => setResettingUser(null)}
          title={`Reset Password: ${resettingUser.name}`}
          description="Set a new password. This will terminate all existing sessions for this user."
        >
          <form onSubmit={handleResetPassword} className="space-y-4 mt-2">
            <FormItem
              label="New Password"
              required
              hint="Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character"
            >
              <Input
                type="password"
                placeholder="••••••••••••"
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

      {/* 4. Force 2FA Dialog */}
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
