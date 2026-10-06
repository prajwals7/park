import { describe, it, expect } from 'vitest';
import {
  calculateNewPassExpiry,
  calculateRenewalExpiry,
  calculatePassStatus,
  formatPaiseToInr,
} from './business-rules.js';

describe('Business Rules Logic', () => {
  it('calculates new pass expiry strictly 30 days ahead', () => {
    const today = new Date('2026-10-01T00:00:00.000Z');
    const expiry = calculateNewPassExpiry(today);
    expect(expiry.toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('renewal extends from current expiry if current expiry is in the future', () => {
    const today = new Date('2026-10-10T00:00:00.000Z');
    const currentExpiry = new Date('2026-10-20T00:00:00.000Z');
    // max(today, currentExpiry) is Oct 20 -> +30 days = Nov 19
    const expiry = calculateRenewalExpiry(currentExpiry, today);
    expect(expiry.toISOString()).toBe('2026-11-19T00:00:00.000Z');
  });

  it('renewal extends from today if current expiry is already expired in the past', () => {
    const today = new Date('2026-10-10T00:00:00.000Z');
    const currentExpiry = new Date('2026-09-01T00:00:00.000Z');
    // max(today, currentExpiry) is Oct 10 -> +30 days = Nov 9
    const expiry = calculateRenewalExpiry(currentExpiry, today);
    expect(expiry.toISOString()).toBe('2026-11-09T00:00:00.000Z');
  });

  it('calculates status ACTIVE when remaining days > 7', () => {
    const today = new Date('2026-10-01T00:00:00.000Z');
    const expiry = new Date('2026-10-15T00:00:00.000Z'); // 14 days
    expect(calculatePassStatus(expiry, today)).toBe('ACTIVE');
  });

  it('calculates status EXPIRING when remaining days is between 0 and 7', () => {
    const today = new Date('2026-10-01T00:00:00.000Z');
    const expiry7 = new Date('2026-10-08T00:00:00.000Z'); // 7 days
    const expiry1 = new Date('2026-10-02T00:00:00.000Z'); // 1 day
    expect(calculatePassStatus(expiry7, today)).toBe('EXPIRING');
    expect(calculatePassStatus(expiry1, today)).toBe('EXPIRING');
  });

  it('calculates status EXPIRED when expiry is in the past', () => {
    const today = new Date('2026-10-10T00:00:00.000Z');
    const expiry = new Date('2026-10-09T00:00:00.000Z');
    expect(calculatePassStatus(expiry, today)).toBe('EXPIRED');
  });

  it('formats paise to INR currency display properly', () => {
    expect(formatPaiseToInr(20000)).toMatch(/200/);
  });
});
