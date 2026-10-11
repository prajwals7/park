'use client';

/**
 * Unified Pass, Payments and Reconciliations local store
 * Enables real-time storing, calculating, and evaluating of issued passes,
 * cash collections, UPI payments, and gate reconciliation registers across both
 * local browsers and offline environments.
 */

export interface RecordedPass {
  id: string;
  passNo: string;
  name: string;
  phone: string;
  gateId: string;
  receiptNo: string;
  amountPaise: number; // typically 20000 paise (Rs 200)
  paymentMode: 'CASH' | 'UPI';
  issuedAt: string; // ISO string
  expiryDate: string; // ISO string
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
}

const PASS_STORE_KEY = 'wpd_passes_records';

export function getRecordedPasses(): RecordedPass[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PASS_STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecordedPass[];
  } catch {
    return [];
  }
}

export function saveRecordedPass(pass: Omit<RecordedPass, 'id' | 'issuedAt' | 'expiryDate' | 'status'> & { id?: string; issuedAt?: string }): RecordedPass {
  const existing = getRecordedPasses();
  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days validity

  const newPass: RecordedPass = {
    id: pass.id || `pass-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    passNo: pass.passNo,
    name: pass.name,
    phone: pass.phone,
    gateId: pass.gateId,
    receiptNo: pass.receiptNo,
    amountPaise: pass.amountPaise || 20000,
    paymentMode: pass.paymentMode,
    issuedAt: pass.issuedAt || now.toISOString(),
    expiryDate: expiry.toISOString(),
    status: 'ACTIVE',
  };

  const updated = [newPass, ...existing];
  try {
    localStorage.setItem(PASS_STORE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('wpd_data_updated'));
  } catch {
    // ignore quota errors
  }
  return newPass;
}

export function clearAllRecordedPasses(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PASS_STORE_KEY);
    localStorage.removeItem('wpd_collector_draft');
    window.dispatchEvent(new Event('wpd_data_updated'));
  } catch {
    // ignore
  }
}

export interface EvaluatedReconciliation {
  totalCollectedInr: number;
  totalPassesCount: number;
  cashInr: number;
  cashCount: number;
  cashPct: number;
  upiInr: number;
  upiCount: number;
  upiPct: number;
  gateBreakdown: Record<string, { passes: number; cashInr: number; upiInr: number; totalInr: number }>;
  expiries: RecordedPass[];
  recentSlips: RecordedPass[];
}

export function evaluateReportsAndReconciliation(): EvaluatedReconciliation {
  const passes = getRecordedPasses();

  let totalPaise = 0;
  let cashPaise = 0;
  let cashCount = 0;
  let upiPaise = 0;
  let upiCount = 0;

  const gateBreakdown: Record<string, { passes: number; cashInr: number; upiInr: number; totalInr: number }> = {
    G2: { passes: 0, cashInr: 0, upiInr: 0, totalInr: 0 },
    GS: { passes: 0, cashInr: 0, upiInr: 0, totalInr: 0 },
    G9: { passes: 0, cashInr: 0, upiInr: 0, totalInr: 0 },
  };

  const now = new Date().getTime();
  const expiries: RecordedPass[] = [];

  for (const p of passes) {
    totalPaise += p.amountPaise;
    const amountInr = p.amountPaise / 100;
    const gateKey = p.gateId in gateBreakdown ? p.gateId : 'G2';

    if (p.paymentMode === 'CASH') {
      cashPaise += p.amountPaise;
      cashCount++;
      gateBreakdown[gateKey].cashInr += amountInr;
    } else {
      upiPaise += p.amountPaise;
      upiCount++;
      gateBreakdown[gateKey].upiInr += amountInr;
    }

    gateBreakdown[gateKey].passes++;
    gateBreakdown[gateKey].totalInr += amountInr;

    // Check expiry
    const expiryTime = new Date(p.expiryDate).getTime();
    const daysLeft = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) {
      expiries.push(p);
    }
  }

  const totalCount = passes.length;
  const cashPct = totalCount > 0 ? Math.round((cashCount / totalCount) * 100) : 0;
  const upiPct = totalCount > 0 ? Math.round((upiCount / totalCount) * 100) : 0;

  return {
    totalCollectedInr: totalPaise / 100,
    totalPassesCount: totalCount,
    cashInr: cashPaise / 100,
    cashCount,
    cashPct,
    upiInr: upiPaise / 100,
    upiCount,
    upiPct,
    gateBreakdown,
    expiries,
    recentSlips: passes,
  };
}
