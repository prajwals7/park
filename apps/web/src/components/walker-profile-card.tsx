'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatMaskedAadhaar } from '@wpd/shared';

export interface WalkerProfileData {
  id: string;
  passNo: string;
  name: string;
  phone: string;
  gateId: string;
  aadhaarLast4: string | null;
  maskedAadhaar?: string;
  status?: 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
  expiryDate?: string;
}

interface WalkerProfileCardProps {
  walker: WalkerProfileData;
  currentUserRole?: 'SUPER_ADMIN' | 'ADMIN' | 'COLLECTOR';
}

export function WalkerProfileCard({ walker, currentUserRole = 'ADMIN' }: WalkerProfileCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [revealReason, setRevealReason] = useState('');
  const [revealedAadhaar, setRevealedAadhaar] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 30-second Auto-Masking Countdown Timer
  useEffect(() => {
    if (!revealedAadhaar || secondsRemaining <= 0) {
      if (revealedAadhaar && secondsRemaining <= 0) {
        setRevealedAadhaar(null);
      }
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setRevealedAadhaar(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [revealedAadhaar, secondsRemaining]);

  const handleRevealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/v1/walkers/${walker.id}/reveal-aadhaar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: reauthPassword,
          reason: revealReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Authorization failed');
      }

      setRevealedAadhaar(data.fullAadhaar);
      setSecondsRemaining(30);
      setIsModalOpen(false);
      setReauthPassword('');
      setRevealReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reveal Aadhaar';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formattedRevealed = revealedAadhaar
    ? `${revealedAadhaar.slice(0, 4)} ${revealedAadhaar.slice(4, 8)} ${revealedAadhaar.slice(8, 12)}`
    : null;

  const defaultMasked = walker.maskedAadhaar || formatMaskedAadhaar(walker.aadhaarLast4);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
            Pass #{walker.passNo}
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-1">{walker.name}</h3>
        </div>
        {walker.status && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              walker.status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-800'
                : walker.status === 'EXPIRING'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
            }`}
          >
            {walker.status}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-slate-400 block font-medium">PHONE NUMBER</span>
            <span className="font-medium text-slate-800">{walker.phone}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">ENTRY GATE</span>
            <span className="font-medium text-slate-800">Gate {walker.gateId}</span>
          </div>
          {walker.expiryDate && (
            <div className="col-span-2">
              <span className="text-xs text-slate-400 block font-medium">VALID UNTIL</span>
              <span className="font-medium text-slate-800">{walker.expiryDate}</span>
            </div>
          )}
        </div>

        {/* Aadhaar Number Display Box */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              AADHAAR IDENTIFICATION
            </span>

            {/* Countdown Badge if revealed */}
            {revealedAadhaar ? (
              <span className="text-xs font-bold text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                Auto-masks in {secondsRemaining}s
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Encrypted at rest</span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="font-mono text-base tracking-widest font-semibold text-slate-900">
              {revealedAadhaar ? (
                <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {formattedRevealed}
                </span>
              ) : (
                <span className="text-slate-600">{defaultMasked}</span>
              )}
            </div>

            {/* Action buttons */}
            <div>
              {revealedAadhaar ? (
                <button
                  type="button"
                  onClick={() => setRevealedAadhaar(null)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border rounded shadow-sm flex items-center gap-1"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Hide
                </button>
              ) : currentUserRole === 'COLLECTOR' ? (
                <span className="text-[11px] text-slate-400 italic">Admin reveal only</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setIsModalOpen(true);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 bg-white border border-indigo-200 rounded shadow-sm flex items-center gap-1 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Reveal (Admin)
                </button>
              )}
            </div>
          </div>

          {revealedAadhaar && (
            <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              Access event written to immutable audit trail.
            </p>
          )}
        </div>
      </div>

      {/* Admin Re-Authentication & Reveal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border">
            <div className="flex items-center gap-3 text-slate-900 border-b pb-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base">Elevated Access Re-Authentication</h4>
                <p className="text-xs text-slate-500">
                  Reveal full 12-digit Aadhaar for {walker.name}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Warning:</strong> Viewing unmasked Aadhaar numbers is an audited
                administrative action. All access reasons, timestamps, and IP addresses are
                permanently recorded.
              </span>
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleRevealSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Admin Password or 2FA Code *
                </label>
                <input
                  type="password"
                  required
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Re-enter your account password"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Official Justification / Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  value={revealReason}
                  onChange={(e) => setRevealReason(e.target.value)}
                  placeholder="e.g. Police verification request ref #2026-901"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !reauthPassword || !revealReason.trim()}
                  className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isLoading ? 'Verifying...' : 'Authorize & Reveal (30s)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
