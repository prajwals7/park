'use client';

import React, { useState, useEffect } from 'react';
import { ApiClient, PASS_CONFIG } from '@wpd/shared';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { FormItem, Input } from '../ui/form-controls';
import { useToast } from '../ui/toast';
import {
  Layers,
  Settings as SettingsIcon,
  Plus,
  Save,
  IndianRupee,
  Calendar,
  AlertTriangle,
  Globe,
} from 'lucide-react';

export interface GateItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  walkersCount?: number;
  paymentsCount?: number;
}

interface AdminGatesSettingsProps {
  apiClient?: ApiClient;
}

export function AdminGatesSettings({ apiClient }: AdminGatesSettingsProps) {
  const { addToast } = useToast();

  // Gates State
  const [gates, setGates] = useState<GateItem[]>([
    { id: 'g-1', code: 'G2', name: 'Main North Gate', isActive: true, walkersCount: 65, paymentsCount: 12 },
    { id: 'g-2', code: 'GS', name: 'South Gate (Main Boulevard)', isActive: true, walkersCount: 42, paymentsCount: 8 },
    { id: 'g-3', code: 'G9', name: 'East Lake View Gate', isActive: true, walkersCount: 23, paymentsCount: 5 },
  ]);
  const [isAddingGate, setIsAddingGate] = useState(false);
  const [newGateCode, setNewGateCode] = useState('');
  const [newGateName, setNewGateName] = useState('');
  const [isSubmittingGate, setIsSubmittingGate] = useState(false);

  // Settings State
  const [passPriceInr, setPassPriceInr] = useState<number>(PASS_CONFIG.PRICE_INR);
  const [validityDays, setValidityDays] = useState<number>(PASS_CONFIG.DURATION_DAYS);
  const [expiringThresholdDays, setExpiringThresholdDays] = useState<number>(
    PASS_CONFIG.EXPIRING_THRESHOLD_DAYS,
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    fetchGatesAndSettings();
  }, []);

  const fetchGatesAndSettings = async () => {
    if (!apiClient) return;

    try {
      const [fetchedGates, fetchedSettings] = await Promise.all([
        apiClient.admin.listGates(),
        apiClient.admin.getSettings(),
      ]);

      if (Array.isArray(fetchedGates) && fetchedGates.length > 0) {
        setGates(fetchedGates as unknown as GateItem[]);
      }

      if (fetchedSettings) {
        const s = fetchedSettings as Record<string, number | undefined>;
        if (s.passPricePaise) setPassPriceInr(Math.round(s.passPricePaise / 100));
        if (s.validityDays) setValidityDays(s.validityDays);
        if (s.expiringThresholdDays) setExpiringThresholdDays(s.expiringThresholdDays);
      }
    } catch {
      // Keep defaults
    }
  };

  // Toggle Gate Status (Active / Inactive)
  const handleToggleGate = async (gate: GateItem) => {
    const nextState = !gate.isActive;
    try {
      if (apiClient) {
        await apiClient.admin.updateGate(gate.id, { isActive: nextState });
      }

      setGates((prev) =>
        prev.map((g) => (g.id === gate.id ? { ...g, isActive: nextState } : g)),
      );

      addToast({
        title: `Gate ${gate.code} ${nextState ? 'Activated' : 'Deactivated'}`,
        description: `Desk operations for Gate ${gate.code} are now ${nextState ? 'enabled' : 'disabled'}.`,
        variant: 'default',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update gate';
      addToast({ title: 'Update Failed', description: msg, variant: 'destructive' });
    }
  };

  // Add New Gate
  const handleAddGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGateCode.trim() || !newGateName.trim()) return;

    setIsSubmittingGate(true);
    try {
      const codeUpper = newGateCode.trim().toUpperCase();
      if (apiClient) {
        await apiClient.admin.createGate({
          code: codeUpper,
          name: newGateName.trim(),
          isActive: true,
        });
      }

      const newGate: GateItem = {
        id: `g-${Date.now()}`,
        code: codeUpper,
        name: newGateName.trim(),
        isActive: true,
        walkersCount: 0,
        paymentsCount: 0,
      };

      setGates((prev) => [...prev, newGate]);

      addToast({
        title: 'New Gate Added',
        description: `Gate ${codeUpper} (${newGateName}) is now operational.`,
        variant: 'success',
      });

      setIsAddingGate(false);
      setNewGateCode('');
      setNewGateName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add gate';
      addToast({ title: 'Creation Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmittingGate(false);
    }
  };

  // Save System Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);

    try {
      if (apiClient) {
        await apiClient.admin.updateSettings({
          passPricePaise: passPriceInr * 100,
          validityDays,
          expiringThresholdDays,
        });
      }

      addToast({
        title: 'Settings Saved & Audited',
        description: `Tariff set to Rs ${passPriceInr}, validity ${validityDays} days, threshold ${expiringThresholdDays} days.`,
        variant: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      addToast({ title: 'Save Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Gate Management */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Gate Management
              </h3>
              <p className="text-xs text-slate-500">Operating park entry points & booths</p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setIsAddingGate(true)}
            className="flex items-center gap-1 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Gate
          </Button>
        </div>

        <div className="space-y-3">
          {gates.map((gate) => (
            <div
              key={gate.id}
              className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    Gate {gate.code}
                  </span>
                  {gate.isActive ? (
                    <Badge variant="success" className="text-[10px]">Active</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{gate.name}</div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                  <span>{gate.walkersCount || 0} registered walkers</span>
                  <span>•</span>
                  <span>{gate.paymentsCount || 0} payments collected</span>
                </div>
              </div>

              <Button
                size="sm"
                variant={gate.isActive ? 'outline' : 'default'}
                onClick={() => handleToggleGate(gate)}
                className="text-xs"
              >
                {gate.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. System Settings */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 rounded-lg bg-park-50 dark:bg-park-950/60 text-park-700 dark:text-park-400">
            <SettingsIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              System Pass Settings
            </h3>
            <p className="text-xs text-slate-500">Tariff, pass validity, and expiration policies</p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <FormItem
            label="Standard Pass Tariff (INR)"
            required
            hint="Physical fee collected per 30-day cycle (stored internally in integer paise)"
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <IndianRupee className="w-4 h-4" />
              </div>
              <Input
                type="number"
                min={1}
                max={10000}
                value={passPriceInr}
                onChange={(e) => setPassPriceInr(Number(e.target.value))}
                className="pl-9 font-bold"
                required
              />
            </div>
          </FormItem>

          <FormItem
            label="Pass Validity Duration (Days)"
            required
            hint="Standard duration added when a pass is issued or renewed"
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <Input
                type="number"
                min={1}
                max={365}
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                className="pl-9 font-bold"
                required
              />
            </div>
          </FormItem>

          <FormItem
            label="Expiring Alert Threshold (Days)"
            required
            hint="Passes expiring within this window will trigger alerts on the desk"
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <Input
                type="number"
                min={1}
                max={30}
                value={expiringThresholdDays}
                onChange={(e) => setExpiringThresholdDays(Number(e.target.value))}
                className="pl-9 font-bold"
                required
              />
            </div>
          </FormItem>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Timezone: <strong className="text-slate-800 dark:text-slate-200">{PASS_CONFIG.TIMEZONE}</strong></span>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              isLoading={isSavingSettings}
              className="flex items-center gap-1.5 text-xs"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </Button>
          </div>
        </form>
      </div>

      {/* Add Gate Modal */}
      {isAddingGate && (
        <Dialog
          isOpen={true}
          onClose={() => setIsAddingGate(false)}
          title="Add New Entry Gate"
          description="Define a new gate entry point with code and name."
        >
          <form onSubmit={handleAddGate} className="space-y-4 mt-2">
            <FormItem label="Gate Code" required hint="e.g. G5, G11, GN">
              <Input
                placeholder="e.g. G5"
                value={newGateCode}
                onChange={(e) => setNewGateCode(e.target.value.toUpperCase())}
                required
              />
            </FormItem>

            <FormItem label="Gate Name / Location Description" required>
              <Input
                placeholder="e.g. West Children Park Gate"
                value={newGateName}
                onChange={(e) => setNewGateName(e.target.value)}
                required
              />
            </FormItem>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddingGate(false)}
                disabled={isSubmittingGate}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmittingGate}>
                Add Gate
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
