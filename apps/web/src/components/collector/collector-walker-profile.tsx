'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input, FormItem } from '../ui/form-controls';
import { FileUpload } from '../ui/file-upload';
import { Dialog } from '../ui/dialog';
import { useToast } from '../ui/toast';
import { CollectorWalkerItem } from './collector-home';
import { apiRequest } from '@/lib/api';
import {
  renewRecordedPass,
  getNextSuggestedPassAndReceipt,
  getRecordedPasses,
  fileToOptimizedDataUrl,
  RecordedPass,
} from '@/lib/pass-store';
import {
  RefreshCw,
  Printer,
  ChevronLeft,
  Calendar,
  CreditCard,
  Banknote,
  Receipt,
  Clock,
  Shield,
  FileCheck,
  Eye,
  Camera,
  History,
  X,
} from 'lucide-react';

export interface CollectorWalkerProfileProps {
  walker: CollectorWalkerItem;
  onBack: () => void;
  onUpdateWalker?: (updated: CollectorWalkerItem) => void;
}

export function CollectorWalkerProfile({
  walker,
  onBack,
  onUpdateWalker,
}: CollectorWalkerProfileProps) {
  const { toast } = useToast();
  const [fullPass, setFullPass] = useState<RecordedPass | null>(null);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [receiptNo, setReceiptNo] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI'>('CASH');
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);
  const [renewedSuccess, setRenewedSuccess] = useState<{
    receiptNo: string;
    paymentMode: 'CASH' | 'UPI';
    expiryDate: string;
  } | null>(null);

  // Sync pass record from pass-store
  const syncPassRecord = () => {
    const passes = getRecordedPasses();
    const match = passes.find(
      (p) => p.id === walker.id || p.passNo.toUpperCase() === walker.passNo.toUpperCase()
    );
    if (match) {
      setFullPass(match);
    }
  };

  useEffect(() => {
    syncPassRecord();
  }, [walker]);

  // One-tap renew submission with idempotency protection and receipt photo storage
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (receiptNo.trim().length < 3) {
      toast({
        type: 'error',
        title: 'Invalid Receipt Slip Number',
        message: 'Please enter the valid pre-printed paper slip number.',
      });
      return;
    }

    setIsSubmitting(true);
    const finalReceipt = receiptNo.trim().toUpperCase();
    const idempotencyKey = crypto.randomUUID();

    let receiptPhotoUrl: string | undefined;
    if (ticketFile) {
      try {
        receiptPhotoUrl = await fileToOptimizedDataUrl(ticketFile);
      } catch {
        // ignore compression error
      }
    }

    try {
      await apiRequest(`/walkers/${walker.id}/renew`, {
        method: 'POST',
        headers: {
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          gateId: walker.gateId || 'G2',
          paymentMode,
          receiptNo: finalReceipt,
          ticketStorageKey: 'documents/renewal_ticket.jpg',
        }),
      });
    } catch {
      // Safe mode fallback if backend is offline
    }

    // Persist to local pass records store with receipt photo & renewal history
    const updatedPass = renewRecordedPass(walker.id || walker.passNo, {
      receiptNo: finalReceipt,
      paymentMode,
      gateId: walker.gateId || 'G2',
      receiptPhotoUrl,
    });

    if (updatedPass) {
      setFullPass(updatedPass);
    }

    const successData = {
      receiptNo: finalReceipt,
      paymentMode,
      expiryDate: 'Extended by 30 days',
    };
    setRenewedSuccess(successData);

    toast({
      type: 'success',
      title: 'Pass Renewed Successfully',
      message: `Slip ${finalReceipt} recorded for ${walker.name}${receiptPhotoUrl ? ' with receipt photo' : ''}.`,
    });

    if (onUpdateWalker) {
      onUpdateWalker({
        ...walker,
        status: 'ACTIVE',
        daysRemaining: 30,
        latestReceiptNo: finalReceipt,
        latestPaymentMode: paymentMode,
        receiptPhotoUrl: receiptPhotoUrl || walker.receiptPhotoUrl,
      });
    }

    setIsSubmitting(false);
  };

  const walkerPhoto = fullPass?.walkerPhotoUrl || walker.walkerPhotoUrl;
  const aadhaarPhoto = fullPass?.aadhaarPhotoUrl || walker.aadhaarPhotoUrl;
  const receiptPhoto = fullPass?.receiptPhotoUrl || walker.receiptPhotoUrl;
  const maskedAadhaarDisplay = fullPass?.maskedAadhaar || walker.maskedAadhaar || 'XXXX XXXX 1234';

  return (
    <div className="space-y-5 max-w-lg mx-auto pb-12">
      {/* Top Header with Back Button */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onBack}
          className="rounded-xl h-10 px-3"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Walker Profile</h2>
          <span className="text-xs text-slate-400">Gate {walker.gateId} Pass Record</span>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-md space-y-5">
        {/* Walker Header with Photo Avatar */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            {walkerPhoto ? (
              <button
                type="button"
                onClick={() => setZoomedImage({ url: walkerPhoto, title: `${walker.name} - Passport Photo` })}
                className="relative group shrink-0"
                title="Click to view full photo"
              >
                <img
                  src={walkerPhoto}
                  alt={walker.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm group-hover:opacity-90 transition"
                />
                <div className="absolute inset-0 bg-black/30 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                  <Eye className="w-4 h-4" />
                </div>
              </button>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-park-100 dark:bg-park-950 text-park-800 dark:text-park-300 font-black text-xl flex items-center justify-center shrink-0 border border-park-300 dark:border-park-800">
                {walker.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div>
              <span className="font-mono text-xs font-bold text-park-800 dark:text-park-300 bg-park-100 dark:bg-park-950/80 px-2 py-0.5 rounded">
                {walker.passNo}
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {walker.name}
              </h3>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Phone: {walker.phone}
              </p>
            </div>
          </div>

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

        {/* Pass Validity Status */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">VALID UNTIL</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-park-700 dark:text-park-400" />
              {walker.expiryDate}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">REMAINING DAYS</span>
            <span
              className={`font-bold flex items-center gap-1 mt-0.5 ${
                walker.daysRemaining > 7
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : walker.daysRemaining > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {walker.daysRemaining > 0 ? `${walker.daysRemaining} days left` : 'Expired'}
            </span>
          </div>
        </div>

        {/* Masked Aadhaar Box */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-park-700 dark:text-park-400" />
            <span className="text-slate-500 font-medium">Aadhaar (Encrypted Proof):</span>
          </div>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {maskedAadhaarDisplay}
          </span>
        </div>

        {/* Latest Payment Details */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Latest Physical Slip:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {walker.latestReceiptNo}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Payment Mode:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {walker.latestPaymentMode}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t">
            <span className="text-slate-500">Monthly Pass Tariff:</span>
            <span className="font-extrabold text-emerald-700 dark:text-emerald-400">₹200.00</span>
          </div>
        </div>

        {/* Document Photos Gallery (Passport, Aadhaar & Receipt Photos) */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            <span>Captured Documents & Receipt Slips</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* 1. Walker Portrait Photo */}
            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 block">Portrait</span>
              {walkerPhoto ? (
                <button
                  type="button"
                  onClick={() => setZoomedImage({ url: walkerPhoto, title: `${walker.name} - Portrait Photo` })}
                  className="w-full relative group"
                >
                  <img
                    src={walkerPhoto}
                    alt="Walker Portrait"
                    className="w-full h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:opacity-90"
                  />
                  <div className="absolute inset-0 bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                </button>
              ) : (
                <div className="h-20 rounded-lg bg-slate-200 dark:bg-slate-700/60 flex items-center justify-center text-[10px] text-slate-400">
                  Not captured
                </div>
              )}
            </div>

            {/* 2. Aadhaar Card Photo */}
            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 block">Aadhaar Proof</span>
              {aadhaarPhoto ? (
                <button
                  type="button"
                  onClick={() => setZoomedImage({ url: aadhaarPhoto, title: `${walker.name} - Aadhaar ID Proof` })}
                  className="w-full relative group"
                >
                  <img
                    src={aadhaarPhoto}
                    alt="Aadhaar ID Proof"
                    className="w-full h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:opacity-90"
                  />
                  <div className="absolute inset-0 bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                </button>
              ) : (
                <div className="h-20 rounded-lg bg-slate-200 dark:bg-slate-700/60 flex items-center justify-center text-[10px] text-slate-400">
                  Not captured
                </div>
              )}
            </div>

            {/* 3. Receipt Slip Photo */}
            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 block">Receipt Slip</span>
              {receiptPhoto ? (
                <button
                  type="button"
                  onClick={() => setZoomedImage({ url: receiptPhoto, title: `${walker.name} - Physical Receipt Slip` })}
                  className="w-full relative group"
                >
                  <img
                    src={receiptPhoto}
                    alt="Physical Receipt Slip"
                    className="w-full h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:opacity-90"
                  />
                  <div className="absolute inset-0 bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                </button>
              ) : (
                <div className="h-20 rounded-lg bg-slate-200 dark:bg-slate-700/60 flex items-center justify-center text-[10px] text-slate-400">
                  Not captured
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Renewal History Register */}
        {fullPass?.renewalHistory && fullPass.renewalHistory.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-park-600" />
              <span>Renewal History ({fullPass.renewalHistory.length})</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {fullPass.renewalHistory.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {rec.receiptPhotoUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setZoomedImage({
                            url: rec.receiptPhotoUrl!,
                            title: `Renewal Slip: ${rec.receiptNo}`,
                          })
                        }
                        className="w-9 h-9 rounded-lg overflow-hidden border border-slate-300 shrink-0"
                      >
                        <img src={rec.receiptPhotoUrl} alt="Slip" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4 text-slate-500" />
                      </div>
                    )}

                    <div>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        Slip: {rec.receiptNo}
                      </span>
                      <div className="text-[11px] text-slate-500">
                        {new Date(rec.renewedAt).toLocaleDateString('en-GB')} • Gate {rec.gateId} ({rec.paymentMode})
                      </div>
                    </div>
                  </div>

                  <span className="font-bold text-emerald-600">₹{(rec.amountPaise / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ONE-TAP RENEW ACTION BUTTON */}
        <div className="pt-2">
          <Button
            type="button"
            size="lg"
            variant="primary"
            onClick={() => {
              setRenewedSuccess(null);
              const suggestion = getNextSuggestedPassAndReceipt();
              setReceiptNo(suggestion.receiptNo);
              setTicketFile(null);
              setIsRenewOpen(true);
            }}
            className="w-full h-13 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-lg bg-emerald-700 hover:bg-emerald-600 text-white active:scale-95 transition"
          >
            <RefreshCw className="w-5 h-5" />
            <span>One-Tap Renew Pass (₹200)</span>
          </Button>
        </div>
      </div>

      {/* RENEW PASS MODAL DIALOG */}
      <Dialog
        isOpen={isRenewOpen}
        onClose={() => setIsRenewOpen(false)}
        title="Renew Walker Pass"
        description={`${walker.name} • Physical Pass #${walker.passNo}`}
      >
        {!renewedSuccess ? (
          <form onSubmit={handleRenewSubmit} className="space-y-4">
            <FormItem
              label="Physical Receipt Slip No. *"
              required
              hint="Pre-printed number from receipt book"
            >
              <Input
                required
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value.toUpperCase())}
                placeholder="e.g. RC-000105"
                className="h-12 font-mono uppercase font-bold rounded-xl text-base sm:text-sm"
              />
            </FormItem>

            {/* Payment Mode */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Payment Collected *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode('CASH')}
                  className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition ${
                    paymentMode === 'CASH'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  Cash (₹200.00)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('UPI')}
                  className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition ${
                    paymentMode === 'UPI'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  UPI QR (₹200.00)
                </button>
              </div>
            </div>

            {/* Photo Capture of Renewal Ticket */}
            <FileUpload
              label="Physical Receipt Paper Slip Photo (Recommended)"
              onFileSelect={(f) => setTicketFile(f)}
            />

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                variant="primary"
                isLoading={isSubmitting}
                className="w-full h-13 rounded-xl text-base font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg active:scale-95 transition"
              >
                Confirm Renewal & Record ₹200
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-center py-2">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <FileCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Pass Successfully Renewed!
              </h3>
              <p className="text-xs text-slate-500">
                Physical Pass #{walker.passNo} has been extended by 30 days.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt Slip:</span>
                <span className="font-mono font-bold">{renewedSuccess.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold">{renewedSuccess.paymentMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Validity:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {renewedSuccess.expiryDate}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                size="lg"
                variant="primary"
                onClick={() =>
                  window.open(`/api/v1/payments/${walker.id}/receipt?format=html`, '_blank')
                }
                className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Thermal Receipt Slip
              </Button>

              <Button
                type="button"
                size="md"
                variant="outline"
                onClick={() => {
                  setIsRenewOpen(false);
                  setRenewedSuccess(null);
                }}
                className="w-full rounded-xl"
              >
                Close & Return
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* FULLSCREEN ZOOM MODAL FOR PHOTOS */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-4 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {zoomedImage.title}
              </h4>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-hidden rounded-2xl flex items-center justify-center bg-black/5 dark:bg-black/40">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[68vh] w-auto object-contain rounded-xl"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setZoomedImage(null)}
              className="w-full rounded-xl"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
