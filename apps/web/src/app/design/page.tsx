'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Badge, BadgeVariant } from '../../components/ui/badge';
import { Input, Textarea, Select, FormItem } from '../../components/ui/form-controls';
import { Dialog } from '../../components/ui/dialog';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { useToast } from '../../components/ui/toast';
import { FileUpload } from '../../components/ui/file-upload';
import { DataTable, ColumnDef } from '../../components/ui/data-table';
import { useTheme } from '../../components/ui/theme-provider';
import { AppShell } from '../../components/layout/app-shell';
import {
  TreePine,
  Sun,
  Moon,
  Sparkles,
  Shield,
  Layers,
  CheckCircle2,
  Trash2,
  BellRing,
} from 'lucide-react';

// Demo Form Schema with Zod
const demoFormSchema = z.object({
  walkerName: z.string().min(2, 'Name must have at least 2 characters'),
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Must be a 10-digit Indian mobile number'),
  passType: z.enum(['STANDARD', 'SENIOR']),
  notes: z.string().max(200, 'Notes cannot exceed 200 characters').optional(),
});
type DemoFormValues = z.infer<typeof demoFormSchema>;

interface DemoWalkerRow extends Record<string, unknown> {
  id: string;
  passNo: string;
  name: string;
  phone: string;
  gate: string;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
  amount: string;
}

const DEMO_TABLE_DATA: DemoWalkerRow[] = [
  {
    id: '1',
    passNo: 'WP-1001',
    name: 'Ananya Sharma',
    phone: '9845012345',
    gate: 'G2',
    status: 'ACTIVE',
    amount: '₹200.00',
  },
  {
    id: '2',
    passNo: 'WP-1002',
    name: 'Rajesh Verma',
    phone: '9876543210',
    gate: 'G2',
    status: 'EXPIRING',
    amount: '₹200.00',
  },
  {
    id: '3',
    passNo: 'WP-1003',
    name: 'Kavitha Reddy',
    phone: '9845112233',
    gate: 'GS',
    status: 'ACTIVE',
    amount: '₹200.00',
  },
  {
    id: '4',
    passNo: 'WP-1004',
    name: 'Mohammed Farooq',
    phone: '9741223344',
    gate: 'G9',
    status: 'EXPIRED',
    amount: '₹200.00',
  },
  {
    id: '5',
    passNo: 'WP-1005',
    name: 'Siddharth Rao',
    phone: '9900112233',
    gate: 'G2',
    status: 'ACTIVE',
    amount: '₹200.00',
  },
  {
    id: '6',
    passNo: 'WP-1006',
    name: 'Deepa Narayan',
    phone: '9844001122',
    gate: 'GS',
    status: 'EXPIRING',
    amount: '₹200.00',
  },
];

export default function DesignSystemPage() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [activeRole, setActiveRole] = useState<'ADMIN' | 'COLLECTOR'>('ADMIN');
  const [activeGate, setActiveGate] = useState('G2');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Table state toggles
  const [tableState, setTableState] = useState<'data' | 'loading' | 'empty'>('data');

  // React Hook Form demo
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DemoFormValues>({
    resolver: zodResolver(demoFormSchema),
    defaultValues: {
      walkerName: '',
      phoneNumber: '',
      passType: 'STANDARD',
      notes: '',
    },
  });

  const onFormSubmit = (data: DemoFormValues) => {
    toast({
      type: 'success',
      title: 'Form Validated Successfully',
      message: `Registered ${data.walkerName} (${data.phoneNumber})`,
    });
    reset();
  };

  const columns: ColumnDef<DemoWalkerRow>[] = [
    { key: 'passNo', header: 'Pass Number', sortable: true, className: 'font-mono font-bold' },
    { key: 'name', header: 'Walker Name', sortable: true, className: 'font-semibold' },
    { key: 'phone', header: 'Phone Number', sortable: false },
    { key: 'gate', header: 'Gate', sortable: true },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <Badge
          variant={
            row.status === 'ACTIVE' ? 'active' : row.status === 'EXPIRING' ? 'expiring' : 'expired'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    { key: 'amount', header: 'Tariff', sortable: false, className: 'font-mono' },
  ];

  return (
    <AppShell
      activeRole={activeRole}
      onRoleChange={setActiveRole}
      activeGate={activeGate}
      onGateChange={setActiveGate}
    >
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header Hero Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-park-100 dark:bg-park-950/80 text-park-900 dark:text-park-300 rounded-full text-xs font-bold border border-park-200 dark:border-park-800">
              <Sparkles className="w-3.5 h-3.5 text-park-700 dark:text-park-400" />
              Walker Pass Desk • Component Library & Design Tokens
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Frontend Design System
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Brand tokens: Deep Park Green primary, Warm Amber accent, neutral greys, Inter/Figtree
              typography, WCAG AA contrast, and dark/light mode via CSS variables.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {resolvedTheme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-600" />
                  Dark Mode
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 1. Brand Colors & Palette */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TreePine className="w-5 h-5 text-park-700 dark:text-park-400" />
              1. Brand Palette & Semantic Colors
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Deep Park Green */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Park Green (Primary Brand)
              </div>
              <div className="h-16 rounded-lg bg-park-900 text-white flex items-end p-2 text-xs font-mono font-bold shadow-xs">
                park-900 (#0f392b)
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-[10px] font-mono text-center">
                <div className="h-8 rounded bg-park-100 flex items-center justify-center text-park-950 font-bold">
                  100
                </div>
                <div className="h-8 rounded bg-park-300 flex items-center justify-center text-park-950 font-bold">
                  300
                </div>
                <div className="h-8 rounded bg-park-500 flex items-center justify-center text-white font-bold">
                  500
                </div>
                <div className="h-8 rounded bg-park-700 flex items-center justify-center text-white font-bold">
                  700
                </div>
                <div className="h-8 rounded bg-park-950 flex items-center justify-center text-white font-bold">
                  950
                </div>
              </div>
            </div>

            {/* Warm Amber */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Warm Amber (Accent Brand)
              </div>
              <div className="h-16 rounded-lg bg-warmAmber-600 text-white flex items-end p-2 text-xs font-mono font-bold shadow-xs">
                warmAmber-600 (#d97706)
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-[10px] font-mono text-center">
                <div className="h-8 rounded bg-warmAmber-100 flex items-center justify-center text-warmAmber-950 font-bold">
                  100
                </div>
                <div className="h-8 rounded bg-warmAmber-300 flex items-center justify-center text-warmAmber-950 font-bold">
                  300
                </div>
                <div className="h-8 rounded bg-warmAmber-500 flex items-center justify-center text-white font-bold">
                  500
                </div>
                <div className="h-8 rounded bg-warmAmber-700 flex items-center justify-center text-white font-bold">
                  700
                </div>
                <div className="h-8 rounded bg-warmAmber-900 flex items-center justify-center text-white font-bold">
                  900
                </div>
              </div>
            </div>

            {/* Semantic Feedback */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Semantic Status Tones
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-white">
                <div className="h-16 rounded-lg bg-emerald-600 flex items-end p-1.5 font-mono text-[11px]">
                  Success
                </div>
                <div className="h-16 rounded-lg bg-amber-500 flex items-end p-1.5 font-mono text-[11px]">
                  Warning
                </div>
                <div className="h-16 rounded-lg bg-rose-600 flex items-end p-1.5 font-mono text-[11px]">
                  Danger
                </div>
              </div>
              <div className="text-[11px] text-slate-400">WCAG AA compliant contrast ratios</div>
            </div>
          </div>
        </section>

        {/* 2. Buttons in All Variants & States */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-park-700 dark:text-park-400" />
              2. Interactive Buttons & Sizes
            </h2>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
            {/* Variants */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase">Button Variants</div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary Park</Button>
                <Button variant="accent">Accent Amber</Button>
                <Button variant="secondary">Secondary Slate</Button>
                <Button variant="outline">Outline Border</Button>
                <Button variant="ghost">Ghost Plain</Button>
                <Button variant="destructive">Destructive Action</Button>
              </div>
            </div>

            {/* Sizes & Loading */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase">
                Sizes & Loading State
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small (Gate Quick Action)</Button>
                <Button size="md">Medium Standard</Button>
                <Button size="lg">Large Touch Target</Button>
                <Button isLoading size="md">
                  Processing...
                </Button>
                <Button disabled size="md">
                  Disabled
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Status Badges */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-park-700 dark:text-park-400" />
              3. Status Badges
            </h2>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
            {(
              [
                'active',
                'expiring',
                'expired',
                'balanced',
                'shortage',
                'excess',
                'primary',
                'accent',
                'neutral',
              ] as BadgeVariant[]
            ).map((v) => (
              <Badge key={v} variant={v}>
                {v.toUpperCase()}
              </Badge>
            ))}
          </div>
        </section>

        {/* 4. Form Controls with Inline Validation */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-park-700 dark:text-park-400" />
              4. Form Controls & Inline Validation (react-hook-form + Zod)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Form */}
            <form
              onSubmit={handleSubmit(onFormSubmit)}
              className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <FormItem
                label="Walker Full Name"
                required
                error={errors.walkerName?.message}
                hint="As printed on government identity proof"
              >
                <Input
                  {...register('walkerName')}
                  error={Boolean(errors.walkerName)}
                  placeholder="e.g. Ramesh Kumar"
                />
              </FormItem>

              <FormItem
                label="10-Digit Phone"
                required
                error={errors.phoneNumber?.message}
                hint="Indian mobile number starting with 6-9"
              >
                <Input
                  {...register('phoneNumber')}
                  error={Boolean(errors.phoneNumber)}
                  placeholder="9876543210"
                />
              </FormItem>

              <FormItem label="Pass Category" required error={errors.passType?.message}>
                <Select {...register('passType')}>
                  <option value="STANDARD">Standard Monthly Pass (₹200)</option>
                  <option value="SENIOR">Senior Citizen Pass (₹200)</option>
                </Select>
              </FormItem>

              <FormItem label="Collector Remarks" error={errors.notes?.message}>
                <Textarea {...register('notes')} rows={2} placeholder="Optional gate notes..." />
              </FormItem>

              <Button type="submit" variant="primary" size="md" className="w-full">
                Submit & Trigger Validation
              </Button>
            </form>

            {/* File & Camera Upload */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Document / Photo Camera Capture
              </div>
              <FileUpload
                label="Aadhaar / ID Card Proof"
                required
                onFileSelect={(f) => {
                  if (f) {
                    toast({
                      type: 'info',
                      title: 'File Attached',
                      message: `${f.name} (${(f.size / 1024).toFixed(0)} KB)`,
                    });
                  }
                }}
              />
            </div>
          </div>
        </section>

        {/* 5. DataTable in 3 States */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-park-700 dark:text-park-400" />
              5. DataTable (Search, Sort, Pagination, States)
            </h2>

            {/* State Switcher */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTableState('data')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  tableState === 'data'
                    ? 'bg-park-900 dark:bg-park-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Data State
              </button>
              <button
                type="button"
                onClick={() => setTableState('loading')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  tableState === 'loading'
                    ? 'bg-park-900 dark:bg-park-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Skeleton Loading
              </button>
              <button
                type="button"
                onClick={() => setTableState('empty')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  tableState === 'empty'
                    ? 'bg-park-900 dark:bg-park-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Empty State
              </button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={tableState === 'empty' ? [] : DEMO_TABLE_DATA}
            isLoading={tableState === 'loading'}
            searchKeys={['name', 'passNo', 'phone']}
            pageSize={4}
          />
        </section>

        {/* 6. Modals, Toasts & Confirmations */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BellRing className="w-5 h-5 text-park-700 dark:text-park-400" />
              6. Accessible Dialogs, Confirmations & Live Toasts
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Modal Triggers */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Dialogs
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setIsModalOpen(true)}>
                  Open Standard Dialog
                </Button>
                <Button variant="destructive" onClick={() => setIsConfirmOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Confirm Destructive Dialog
                </Button>
              </div>
            </div>

            {/* Toast Triggers */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Toast Notifications (aria-live)
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    toast({
                      type: 'success',
                      title: 'Pass Issued',
                      message: 'Physical receipt slip RC-001099 recorded.',
                    })
                  }
                >
                  Success Toast
                </Button>
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() =>
                    toast({
                      type: 'warning',
                      title: 'Expiring Soon',
                      message: 'Walker pass expires in 3 days.',
                    })
                  }
                >
                  Warning Toast
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    toast({
                      type: 'error',
                      title: 'Duplicate Slip Number',
                      message: 'Physical receipt RC-00101 already recorded.',
                    })
                  }
                >
                  Error Toast
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    toast({
                      type: 'info',
                      title: 'Shift Reconciliation',
                      message: 'Cash handover calculated for Gate G2.',
                    })
                  }
                >
                  Info Toast
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Standard Dialog Demo */}
        <Dialog
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Standard Dialog Modal"
          description="Accessible focus trap with ESC listener"
        >
          <div className="space-y-4">
            <p className="text-sm">
              This modal dialog handles ESC key closing, locks background scroll, and has proper
              ARIA attributes (`role=&quot;dialog&quot;`, `aria-modal=&quot;true&quot;`).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
                Got It
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Confirm Destructive Dialog Demo */}
        <ConfirmDialog
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          isLoading={isDeleting}
          title="Confirm Soft Delete Walker"
          description="Are you sure you want to deactivate this walker pass? The record will be soft-deleted and an entry written to the immutable audit log."
          confirmLabel="Soft Delete Record"
          onConfirm={async () => {
            setIsDeleting(true);
            setTimeout(() => {
              setIsDeleting(false);
              setIsConfirmOpen(false);
              toast({
                type: 'warning',
                title: 'Record Deactivated',
                message: 'Walker pass soft-deleted with audit trail.',
              });
            }, 1000);
          }}
        />
      </div>
    </AppShell>
  );
}
