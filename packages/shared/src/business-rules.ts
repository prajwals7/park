import { PASS_CONFIG, PassStatus } from './constants.js';

export function calculateNewPassExpiry(startDate: Date = new Date()): Date {
  const expiry = new Date(startDate);
  expiry.setUTCDate(expiry.getUTCDate() + PASS_CONFIG.DURATION_DAYS);
  return expiry;
}

export function calculateRenewalExpiry(currentExpiry: Date, renewalDate: Date = new Date()): Date {
  // Business rule: renewal extends from max(today, current expiry) by 30 days
  const baseDate = renewalDate > currentExpiry ? renewalDate : currentExpiry;
  const expiry = new Date(baseDate);
  expiry.setUTCDate(expiry.getUTCDate() + PASS_CONFIG.DURATION_DAYS);
  return expiry;
}

export function calculatePassStatus(expiryDate: Date, checkDate: Date = new Date()): PassStatus {
  const diffMs = expiryDate.getTime() - checkDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'EXPIRED';
  }
  if (diffDays <= PASS_CONFIG.EXPIRING_THRESHOLD_DAYS) {
    return 'EXPIRING';
  }
  return 'ACTIVE';
}

export function formatPaiseToInr(paise: number): string {
  const inr = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(inr);
}
