'use client';

import React, { useState, useId } from 'react';
import { VerhoeffUtil, aadhaarSchema, GATES, formatPaiseToInr, PASS_CONFIG } from '@wpd/shared';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  FileText,
  User,
  Phone,
  MapPin,
} from 'lucide-react';

interface WalkerRegistrationFormProps {
  onSuccess?: (walker: { id: string; passNo: string; name: string }) => void;
}

export function WalkerRegistrationForm({ onSuccess }: WalkerRegistrationFormProps) {
  const formId = useId();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gateId, setGateId] = useState<string>(GATES[0]);
  const [aadhaarRaw, setAadhaarRaw] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Formatting Aadhaar into 4-digit groups: "XXXX XXXX XXXX"
  const formatAadhaarInput = (value: string): string => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 12);
    const parts: string[] = [];
    for (let i = 0; i < digitsOnly.length; i += 4) {
      parts.push(digitsOnly.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanDigits = e.target.value.replace(/\s+/g, '').replace(/\D/g, '').slice(0, 12);
    setAadhaarRaw(cleanDigits);
  };

  // Live Verhoeff & format validation
  const cleanAadhaar = aadhaarRaw;
  const isLengthValid = cleanAadhaar.length === 12;
  const startsValid = cleanAadhaar.length > 0 ? !['0', '1'].includes(cleanAadhaar[0] ?? '') : true;
  const isVerhoeffValid = isLengthValid && startsValid && VerhoeffUtil.validate(cleanAadhaar);

  const getAadhaarValidationStatus = () => {
    if (!cleanAadhaar) return null;
    if (!startsValid) {
      return { status: 'invalid', message: 'Aadhaar cannot begin with 0 or 1' };
    }
    if (cleanAadhaar.length < 12) {
      return { status: 'pending', message: `${12 - cleanAadhaar.length} more digits required` };
    }
    if (isVerhoeffValid) {
      return { status: 'valid', message: 'Valid Aadhaar (Verhoeff checksum verified)' };
    }
    return { status: 'invalid', message: 'Invalid Aadhaar checksum (Verhoeff check failed)' };
  };

  const validationStatus = getAadhaarValidationStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!consentAgreed) {
      setErrorMessage('Explicit citizen consent is mandatory to process Aadhaar details.');
      return;
    }

    const parseResult = aadhaarSchema.safeParse(cleanAadhaar);
    if (!parseResult.success) {
      setErrorMessage(parseResult.error.errors[0]?.message ?? 'Invalid Aadhaar number');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/walkers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          gateId,
          aadhaarNumber: cleanAadhaar,
          consentAgreed: true,
          notes: notes.trim() || undefined,
          amountPaise: PASS_CONFIG.PRICE_PAISE,
          paymentMode: 'CASH',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setSuccessMessage(`Walker registered successfully! Pass No: ${data.passNo}`);
      if (onSuccess) {
        onSuccess(data);
      }
      // Reset form
      setName('');
      setPhone('');
      setAadhaarRaw('');
      setConsentAgreed(false);
      setNotes('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6"
    >
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            New Walker Registration
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Standard 30-day park pass ({formatPaiseToInr(PASS_CONFIG.PRICE_PAISE)})
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
          <ShieldCheck className="w-4 h-4" />
          AES-256 Protected
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`${formId}-name`}
            className="block text-xs font-semibold text-slate-700 uppercase mb-1"
          >
            Full Name *
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Kumar"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${formId}-phone`}
            className="block text-xs font-semibold text-slate-700 uppercase mb-1"
          >
            Mobile Number (10 digits) *
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              id={`${formId}-phone`}
              type="tel"
              required
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="9876543210"
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`${formId}-gate`}
            className="block text-xs font-semibold text-slate-700 uppercase mb-1"
          >
            Registration Entry Gate *
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <select
              id={`${formId}-gate`}
              value={gateId}
              onChange={(e) => setGateId(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {GATES.map((g) => (
                <option key={g} value={g}>
                  Gate {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 12-Digit Aadhaar Input with live Verhoeff Checksum Validation */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor={`${formId}-aadhaar`}
              className="text-xs font-semibold text-slate-700 uppercase"
            >
              12-Digit Aadhaar Number *
            </label>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-500" />
              Field-Level Encrypted
            </span>
          </div>

          <div className="relative">
            <input
              id={`${formId}-aadhaar`}
              type="text"
              required
              maxLength={14} // 12 digits + 2 spaces
              value={formatAadhaarInput(cleanAadhaar)}
              onChange={handleAadhaarChange}
              placeholder="•••• •••• ••••"
              className={`w-full px-3 py-2 font-mono tracking-widest text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                validationStatus?.status === 'valid'
                  ? 'border-emerald-500 focus:ring-emerald-500 bg-emerald-50/20'
                  : validationStatus?.status === 'invalid'
                    ? 'border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'focus:ring-indigo-500'
              }`}
            />
            {validationStatus && (
              <div className="absolute right-3 top-2.5">
                {validationStatus.status === 'valid' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
                {validationStatus.status === 'invalid' && (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
            )}
          </div>

          {validationStatus && (
            <p
              className={`text-xs mt-1.5 flex items-center gap-1 ${
                validationStatus.status === 'valid'
                  ? 'text-emerald-700'
                  : validationStatus.status === 'invalid'
                    ? 'text-red-600'
                    : 'text-slate-500'
              }`}
            >
              {validationStatus.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor={`${formId}-notes`}
          className="block text-xs font-semibold text-slate-700 uppercase mb-1"
        >
          Internal Notes (Optional)
        </label>
        <textarea
          id={`${formId}-notes`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Senior citizen, frequent morning runner"
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Mandatory Aadhaar Consent Checkbox */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentAgreed}
            onChange={(e) => setConsentAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
          />
          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900 block mb-0.5">
              Citizen Aadhaar Data Consent Declaration *
            </span>
            I hereby voluntarily provide my 12-digit Aadhaar number to the Park Administration
            solely for identity verification and walker pass issuance. I understand that my Aadhaar
            number is protected by AES-256-GCM envelope encryption and will never be shared or
            displayed openly without administrative authorization.
          </div>
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setName('');
            setPhone('');
            setAadhaarRaw('');
            setConsentAgreed(false);
            setNotes('');
          }}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          Reset
        </button>

        <button
          type="submit"
          disabled={isSubmitting || !consentAgreed || !isVerhoeffValid}
          className="px-6 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
        >
          <FileText className="w-4 h-4" />
          {isSubmitting ? 'Processing Transaction...' : 'Register & Issue Pass (₹200)'}
        </button>
      </div>
    </form>
  );
}
