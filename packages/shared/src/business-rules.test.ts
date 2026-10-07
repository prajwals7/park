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

  describe('Physical Receipt & Pass Number Validation', () => {
    it('normalises, trims, and uppercases physical receipt numbers', async () => {
      const { receiptNoSchema } = await import('./walker-schemas.js');
      const parsed = receiptNoSchema.parse('  rc-000101  ');
      expect(parsed).toBe('RC-000101');
    });

    it('accepts letters, numbers, and hyphens between 3 and 20 characters', async () => {
      const { receiptNoSchema } = await import('./walker-schemas.js');
      expect(receiptNoSchema.safeParse('RCP-99').success).toBe(true);
      expect(receiptNoSchema.safeParse('A1-B2-C3').success).toBe(true);
      expect(receiptNoSchema.safeParse('REC12345678901234567').success).toBe(true); // 20 chars
    });

    it('rejects receipt numbers with invalid characters or incorrect length', async () => {
      const { receiptNoSchema } = await import('./walker-schemas.js');
      // Less than 3 chars
      expect(receiptNoSchema.safeParse('RC').success).toBe(false);
      // Greater than 20 chars
      expect(receiptNoSchema.safeParse('REC1234567890123456789').success).toBe(false);
      // Special characters not allowed
      expect(receiptNoSchema.safeParse('RC#001').success).toBe(false);
      expect(receiptNoSchema.safeParse('RC 001').success).toBe(false);
      expect(receiptNoSchema.safeParse('RC_001').success).toBe(false);
    });

    it('validates admin payment correction schema', async () => {
      const { correctPaymentSchema } = await import('./walker-schemas.js');
      // Valid correction with receiptNo change
      const res1 = correctPaymentSchema.safeParse({
        receiptNo: 'rc-000200',
        reason: 'Collector misread physical paper receipt number',
      });
      expect(res1.success).toBe(true);
      if (res1.success) {
        expect(res1.data.receiptNo).toBe('RC-000200');
      }

      // Valid correction with mode change
      const res2 = correctPaymentSchema.safeParse({
        mode: 'UPI',
        reason: 'Collector recorded cash instead of gate UPI scan',
      });
      expect(res2.success).toBe(true);

      // Rejects when neither receiptNo nor mode is provided
      const res3 = correctPaymentSchema.safeParse({
        reason: 'Missing fields',
      });
      expect(res3.success).toBe(false);

      // Rejects when reason is too short
      const res4 = correctPaymentSchema.safeParse({
        mode: 'CASH',
        reason: 'Bad',
      });
      expect(res4.success).toBe(false);
    });
  });
});
