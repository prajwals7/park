'use client';

/**
 * Unified Pass, Payments and Reconciliations store
 * Enables real-time storing, calculating, and evaluating of issued passes,
 * cash collections, UPI payments, and gate reconciliation registers across both
 * local browsers, mobile devices, and offline environments.
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
  notes?: string;
}

const PASS_STORE_KEY = 'wpd_passes_records';

export function getRecordedPasses(): RecordedPass[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PASS_STORE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecordedPass[];
    // Dynamically recalculate status based on current time
    const now = Date.now();
    return list.map((p) => {
      const expiry = new Date(p.expiryDate).getTime();
      const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      const status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' =
        daysLeft <= 0 ? 'EXPIRED' : daysLeft <= 7 ? 'EXPIRING' : 'ACTIVE';
      return { ...p, status };
    });
  } catch {
    return [];
  }
}

export function saveRecordedPass(
  pass: Omit<RecordedPass, 'id' | 'issuedAt' | 'expiryDate' | 'status'> & {
    id?: string;
    issuedAt?: string;
    expiryDate?: string;
  }
): RecordedPass {
  const existing = getRecordedPasses();
  const now = new Date();
  const expiry = pass.expiryDate
    ? new Date(pass.expiryDate)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days validity

  const newPass: RecordedPass = {
    id: pass.id || `pass-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    passNo: pass.passNo.trim().toUpperCase(),
    name: pass.name.trim(),
    phone: pass.phone.trim(),
    gateId: pass.gateId,
    receiptNo: pass.receiptNo.trim().toUpperCase(),
    amountPaise: pass.amountPaise || 20000,
    paymentMode: pass.paymentMode,
    issuedAt: pass.issuedAt || now.toISOString(),
    expiryDate: expiry.toISOString(),
    status: 'ACTIVE',
    notes: pass.notes,
  };

  const updated = [newPass, ...existing];
  try {
    localStorage.setItem(PASS_STORE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('wpd_data_updated'));
  } catch {
    // ignore storage quota errors
  }
  return newPass;
}

export function renewRecordedPass(
  passNoOrId: string,
  renewalDetails: {
    receiptNo: string;
    paymentMode: 'CASH' | 'UPI';
    gateId?: string;
  }
): RecordedPass | null {
  const existing = getRecordedPasses();
  const index = existing.findIndex(
    (p) => p.id === passNoOrId || p.passNo.toUpperCase() === passNoOrId.toUpperCase()
  );
  if (index === -1) return null;

  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from renewal

  const target = existing[index];
  const updated: RecordedPass = {
    ...target,
    receiptNo: renewalDetails.receiptNo.trim().toUpperCase(),
    paymentMode: renewalDetails.paymentMode,
    gateId: renewalDetails.gateId || target.gateId,
    issuedAt: now.toISOString(),
    expiryDate: expiry.toISOString(),
    status: 'ACTIVE',
  };

  existing[index] = updated;
  try {
    localStorage.setItem(PASS_STORE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new Event('wpd_data_updated'));
  } catch {
    // ignore
  }
  return updated;
}

export function updateRecordedPass(
  passNoOrId: string,
  fields: Partial<Pick<RecordedPass, 'name' | 'phone' | 'gateId' | 'notes'>>
): boolean {
  const existing = getRecordedPasses();
  const index = existing.findIndex(
    (p) => p.id === passNoOrId || p.passNo.toUpperCase() === passNoOrId.toUpperCase()
  );
  if (index === -1) return false;

  existing[index] = { ...existing[index], ...fields };
  try {
    localStorage.setItem(PASS_STORE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new Event('wpd_data_updated'));
    return true;
  } catch {
    return false;
  }
}

export function deleteRecordedPass(passNoOrId: string): boolean {
  const existing = getRecordedPasses();
  const filtered = existing.filter(
    (p) => p.id !== passNoOrId && p.passNo.toUpperCase() !== passNoOrId.toUpperCase()
  );
  if (filtered.length === existing.length) return false;
  try {
    localStorage.setItem(PASS_STORE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('wpd_data_updated'));
    return true;
  } catch {
    return false;
  }
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

/**
 * Helper to auto-suggest the next sequential card number and receipt number.
 * e.g., if highest pass is WP-000105, suggests WP-000106 and RC-000106.
 */
export function getNextSuggestedPassAndReceipt(): { passNo: string; receiptNo: string } {
  const passes = getRecordedPasses();
  let maxPassNum = 100;
  let maxRcNum = 100;

  for (const p of passes) {
    const passMatch = p.passNo.match(/(\d+)/);
    if (passMatch) {
      const n = parseInt(passMatch[1], 10);
      if (n > maxPassNum) maxPassNum = n;
    }
    const rcMatch = p.receiptNo.match(/(\d+)/);
    if (rcMatch) {
      const n = parseInt(rcMatch[1], 10);
      if (n > maxRcNum) maxRcNum = n;
    }
  }

  const nextPass = maxPassNum + 1;
  const nextRc = maxRcNum + 1;

  const pad = (n: number) => n.toString().padStart(6, '0');
  return {
    passNo: `WP-${pad(nextPass)}`,
    receiptNo: `RC-${pad(nextRc)}`,
  };
}

export interface GateShiftSummary {
  gateId: string;
  totalPassesToday: number;
  cashSlipsCount: number;
  cashAmountInr: number;
  upiSlipsCount: number;
  upiAmountInr: number;
  totalRevenueInr: number;
}

export function getGateShiftSummary(gateId: string): GateShiftSummary {
  const passes = getRecordedPasses();
  const todayStr = new Date().toISOString().slice(0, 10);

  const gatePasses = passes.filter((p) => {
    const isGate = gateId === 'ALL' || p.gateId === gateId;
    const isToday = p.issuedAt.startsWith(todayStr);
    return isGate && isToday;
  });

  let cashAmount = 0;
  let cashCount = 0;
  let upiAmount = 0;
  let upiCount = 0;

  for (const p of gatePasses) {
    const inr = p.amountPaise / 100;
    if (p.paymentMode === 'CASH') {
      cashAmount += inr;
      cashCount++;
    } else {
      upiAmount += inr;
      upiCount++;
    }
  }

  return {
    gateId,
    totalPassesToday: gatePasses.length,
    cashSlipsCount: cashCount,
    cashAmountInr: cashAmount,
    upiSlipsCount: upiCount,
    upiAmountInr: upiAmount,
    totalRevenueInr: cashAmount + upiAmount,
  };
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
  gateBreakdown: Record<
    string,
    { passes: number; cashInr: number; upiInr: number; totalInr: number }
  >;
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

  const gateBreakdown: Record<
    string,
    { passes: number; cashInr: number; upiInr: number; totalInr: number }
  > = {
    G2: { passes: 0, cashInr: 0, upiInr: 0, totalInr: 0 },
    GS: { passes: 0, cashInr: 0, upiInr: 0, totalInr: 0 },
    G9: { passes: 0, cashInr: 0, upiInr: 0, totalInr: 0 },
  };

  const now = Date.now();
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
