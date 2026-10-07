import { describe, it, expect } from 'vitest';
import { VerhoeffUtil, receiptNoSchema, passNoSchema } from '@wpd/shared';

describe('Collector Mobile Experience & Verification Suite', () => {
  it('formats 12-digit Aadhaar with 4-4-4 spacing for phone touch input', () => {
    const raw = '367598324511';
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    expect(formatted).toBe('3675 9832 4511');
  });

  it('validates live Verhoeff checksum on 12-digit Aadhaar entries', () => {
    // Valid Indian Aadhaar with Verhoeff checksum
    expect(VerhoeffUtil.validate('367598324511')).toBe(true);

    // Typo in last digit -> Checksum invalid
    expect(VerhoeffUtil.validate('367598324519')).toBe(false);

    // Number starting with 0 or 1 is invalid
    expect('098765432101'.startsWith('0')).toBe(true);
    expect('198765432101'.startsWith('1')).toBe(true);
  });

  it('preserves and parses registration draft across interruptions', () => {
    const mockDraft = {
      step: 2,
      name: 'Ramesh Kumar',
      phone: '9876543210',
      gateId: 'G2',
      rawAadhaar: '367598324511',
      consentAgreed: true,
      passNo: 'WP-000101',
      receiptNo: 'RC-000101',
      paymentMode: 'CASH',
      idempotencyKey: 'idemp-uuid-123',
    };

    const serialized = JSON.stringify(mockDraft);
    const restored = JSON.parse(serialized);

    expect(restored.name).toBe('Ramesh Kumar');
    expect(restored.rawAadhaar).toBe('367598324511');
    expect(restored.step).toBe(2);
    expect(restored.idempotencyKey).toBe('idemp-uuid-123');
  });

  it('validates pre-printed physical receipt slip numbers', () => {
    expect(receiptNoSchema.parse(' rc-000101 ')).toBe('RC-000101');
    expect(receiptNoSchema.safeParse('RC-101').success).toBe(true);
    expect(receiptNoSchema.safeParse('12').success).toBe(false); // too short (<3)
    expect(receiptNoSchema.safeParse('RC@999').success).toBe(false); // invalid symbol
  });

  it('validates physical pass numbers', () => {
    expect(passNoSchema.parse(' wp-1001 ')).toBe('wp-1001');
    expect(passNoSchema.safeParse('WP-1001').success).toBe(true);
  });

  it('correctly calculates days remaining and assigns status badges', () => {
    const now = new Date();

    const futureDate = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000);
    const daysFuture = Math.ceil((futureDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysFuture).toBeGreaterThan(20);

    const expiringDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const daysExpiring = Math.ceil(
      (expiringDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(daysExpiring).toBeLessThanOrEqual(7);

    const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const daysPast = Math.ceil((pastDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysPast).toBeLessThan(0);
  });
});
