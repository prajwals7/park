'use client';

/**
 * Unified Pass, Payments, Photos, and Reconciliations Store
 * Enables real-time storing, calculating, and evaluating of issued passes,
 * captured identity & receipt photos, cash collections, UPI payments,
 * and collector staff administration across browsers and mobile devices.
 */

export interface RenewalRecord {
  renewedAt: string;
  receiptNo: string;
  receiptPhotoUrl?: string;
  paymentMode: 'CASH' | 'UPI';
  gateId: string;
  amountPaise: number;
}

export interface RecordedPass {
  id: string;
  passNo: string;
  name: string;
  phone: string;
  gateId: string;
  rawAadhaar?: string;
  maskedAadhaar?: string;
  aadhaarPhotoUrl?: string; // Stored photo of Aadhaar proof
  walkerPhotoUrl?: string;   // Stored passport photo of walker
  receiptPhotoUrl?: string;  // Stored photo of paper receipt slip
  receiptNo: string;
  amountPaise: number; // typically 20000 paise (Rs 200)
  paymentMode: 'CASH' | 'UPI';
  issuedAt: string; // ISO string
  expiryDate: string; // ISO string
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
  notes?: string;
  renewalHistory?: RenewalRecord[];
}

const PASS_STORE_KEY = 'wpd_passes_records';

/**
 * Image compression utility to convert any camera or gallery photo
 * into an optimized JPEG Data URL (typically 20KB - 40KB).
 * Prevents storage quota errors and enables permanent offline photo storage.
 */
export async function fileToOptimizedDataUrl(
  file: File,
  maxWidth = 720,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = () => resolve(event.target?.result as string);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

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
    rawAadhaar?: string;
    maskedAadhaar?: string;
    aadhaarPhotoUrl?: string;
    walkerPhotoUrl?: string;
    receiptPhotoUrl?: string;
  }
): RecordedPass {
  const existing = getRecordedPasses();
  const now = new Date();
  const expiry = pass.expiryDate
    ? new Date(pass.expiryDate)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days validity

  // Mask Aadhaar if provided
  let maskedAadhaar = pass.maskedAadhaar;
  if (!maskedAadhaar && pass.rawAadhaar) {
    const raw = pass.rawAadhaar.replace(/\D/g, '');
    maskedAadhaar = raw.length === 12 ? `XXXX XXXX ${raw.slice(-4)}` : raw;
  }

  const initialRenewalHistory: RenewalRecord[] = pass.receiptPhotoUrl
    ? [
        {
          renewedAt: now.toISOString(),
          receiptNo: pass.receiptNo.trim().toUpperCase(),
          receiptPhotoUrl: pass.receiptPhotoUrl,
          paymentMode: pass.paymentMode,
          gateId: pass.gateId,
          amountPaise: pass.amountPaise || 20000,
        },
      ]
    : [];

  const newPass: RecordedPass = {
    id: pass.id || `pass-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    passNo: pass.passNo.trim().toUpperCase(),
    name: pass.name.trim(),
    phone: pass.phone.trim(),
    gateId: pass.gateId,
    receiptNo: pass.receiptNo.trim().toUpperCase(),
    amountPaise: pass.amountPaise || 20000,
    paymentMode: pass.paymentMode,
    rawAadhaar: pass.rawAadhaar,
    maskedAadhaar,
    aadhaarPhotoUrl: pass.aadhaarPhotoUrl,
    walkerPhotoUrl: pass.walkerPhotoUrl,
    receiptPhotoUrl: pass.receiptPhotoUrl,
    issuedAt: pass.issuedAt || now.toISOString(),
    expiryDate: expiry.toISOString(),
    status: 'ACTIVE',
    notes: pass.notes,
    renewalHistory: initialRenewalHistory,
  };

  // Prepend new pass (or replace if existing by passNo)
  const filtered = existing.filter(
    (p) => p.id !== newPass.id && p.passNo.toUpperCase() !== newPass.passNo
  );
  const updated = [newPass, ...filtered];

  try {
    localStorage.setItem(PASS_STORE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('wpd_data_updated'));
  } catch {
    // If storage is full, strip oldest large image blobs and retry
    try {
      const lightweight = updated.map((p, idx) => {
        if (idx > 5) {
          return {
            ...p,
            aadhaarPhotoUrl: undefined,
          };
        }
        return p;
      });
      localStorage.setItem(PASS_STORE_KEY, JSON.stringify(lightweight));
      window.dispatchEvent(new Event('wpd_data_updated'));
    } catch {
      // ignore
    }
  }
  return newPass;
}

export function renewRecordedPass(
  passNoOrId: string,
  renewalDetails: {
    receiptNo: string;
    paymentMode: 'CASH' | 'UPI';
    gateId?: string;
    receiptPhotoUrl?: string;
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

  const renewalRecord: RenewalRecord = {
    renewedAt: now.toISOString(),
    receiptNo: renewalDetails.receiptNo.trim().toUpperCase(),
    receiptPhotoUrl: renewalDetails.receiptPhotoUrl,
    paymentMode: renewalDetails.paymentMode,
    gateId: renewalDetails.gateId || target.gateId,
    amountPaise: 20000,
  };

  const history = target.renewalHistory ? [renewalRecord, ...target.renewalHistory] : [renewalRecord];

  const updated: RecordedPass = {
    ...target,
    receiptNo: renewalDetails.receiptNo.trim().toUpperCase(),
    receiptPhotoUrl: renewalDetails.receiptPhotoUrl || target.receiptPhotoUrl,
    paymentMode: renewalDetails.paymentMode,
    gateId: renewalDetails.gateId || target.gateId,
    issuedAt: now.toISOString(),
    expiryDate: expiry.toISOString(),
    status: 'ACTIVE',
    renewalHistory: history,
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
  fields: Partial<Pick<RecordedPass, 'name' | 'phone' | 'gateId' | 'notes' | 'walkerPhotoUrl' | 'aadhaarPhotoUrl' | 'receiptPhotoUrl'>>
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
    localStorage.removeItem('wpd_recruited_collectors');
    window.dispatchEvent(new Event('wpd_data_updated'));
    window.dispatchEvent(new Event('wpd_collectors_updated'));
  } catch {
    // ignore
  }
}

export interface RecruitedCollector {
  id: string;
  collectorId: string; // e.g. COL-G2-0104
  name: string;
  email: string;
  password?: string;
  phone: string;
  gate: string;
  assignedGate?: string;
  shift: string;
  status: 'ACTIVE' | 'DISABLED' | 'CANCELLED';
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  avatarUrl?: string;
}

const COLLECTORS_STORE_KEY = 'wpd_recruited_collectors';

export function generateCollectorId(gate: string): string {
  const cleanGate = (gate || 'G2').toUpperCase();
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `COL-${cleanGate}-${randNum}`;
}

export function getRecruitedCollectors(): RecruitedCollector[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COLLECTORS_STORE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecruitedCollector[];
    // Backwards compatibility: ensure all have collectorId
    return list.map((c) => ({
      ...c,
      collectorId: c.collectorId || generateCollectorId(c.assignedGate || c.gate || 'G2'),
      status: c.status || 'ACTIVE',
    }));
  } catch {
    return [];
  }
}

export function saveRecruitedCollector(
  collector: Omit<RecruitedCollector, 'id' | 'createdAt' | 'status' | 'collectorId'> & {
    id?: string;
    collectorId?: string;
    gate?: string;
    assignedGate?: string;
    status?: 'ACTIVE' | 'DISABLED' | 'CANCELLED';
  }
): RecruitedCollector {
  const existing = getRecruitedCollectors();
  const gateVal = collector.assignedGate || collector.gate || 'G2';
  const assignedId = collector.collectorId || generateCollectorId(gateVal);

  const newCollector: RecruitedCollector = {
    id: collector.id || `collector-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    collectorId: assignedId,
    name: collector.name.trim(),
    email: collector.email.trim().toLowerCase(),
    password: collector.password || 'Collector@123',
    phone: collector.phone.trim(),
    gate: gateVal,
    assignedGate: gateVal,
    shift: collector.shift || 'General',
    status: collector.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  const updated = [newCollector, ...existing.filter((c) => c.email !== newCollector.email && c.id !== newCollector.id)];
  try {
    localStorage.setItem(COLLECTORS_STORE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('wpd_collectors_updated'));
  } catch {
    // ignore
  }
  return newCollector;
}

export function cancelRecruitedCollector(
  id: string,
  reason = 'Admin cancelled authorization'
): RecruitedCollector | null {
  const existing = getRecruitedCollectors();
  const index = existing.findIndex((c) => c.id === id);
  if (index === -1) return null;

  existing[index].status = 'CANCELLED';
  existing[index].cancelledAt = new Date().toISOString();
  existing[index].cancelReason = reason;

  try {
    localStorage.setItem(COLLECTORS_STORE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new Event('wpd_collectors_updated'));
  } catch {
    // ignore
  }
  return existing[index];
}

export function toggleRecruitedCollectorStatus(id: string): RecruitedCollector | null {
  const existing = getRecruitedCollectors();
  const index = existing.findIndex((c) => c.id === id);
  if (index === -1) return null;
  existing[index].status = existing[index].status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  try {
    localStorage.setItem(COLLECTORS_STORE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new Event('wpd_collectors_updated'));
  } catch {
    // ignore
  }
  return existing[index];
}

export function deleteRecruitedCollector(id: string): boolean {
  const existing = getRecruitedCollectors();
  const filtered = existing.filter((c) => c.id !== id);
  if (filtered.length === existing.length) return false;
  try {
    localStorage.setItem(COLLECTORS_STORE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('wpd_collectors_updated'));
    return true;
  } catch {
    return false;
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

  let cashAmount = 0;
  let cashCount = 0;
  let upiAmount = 0;
  let upiCount = 0;
  let totalPasses = 0;

  for (const p of passes) {
    if (p.gateId === gateId && p.issuedAt.startsWith(todayStr)) {
      totalPasses++;
      const inr = p.amountPaise / 100;
      if (p.paymentMode === 'CASH') {
        cashAmount += inr;
        cashCount++;
      } else {
        upiAmount += inr;
        upiCount++;
      }
    }
  }

  return {
    gateId,
    totalPassesToday: totalPasses,
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
