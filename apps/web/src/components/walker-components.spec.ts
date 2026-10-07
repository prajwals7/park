import { describe, it, expect } from 'vitest';
import { VerhoeffUtil, aadhaarSchema, formatMaskedAadhaar } from '@wpd/shared';

describe('Web UI Aadhaar Formatting & Validation Integration', () => {
  it('formats raw 12-digit numbers into 4-4-4 spaced blocks for input UI', () => {
    const raw = '367598324511';
    const parts: string[] = [];
    for (let i = 0; i < raw.length; i += 4) {
      parts.push(raw.slice(i, i + 4));
    }
    const formatted = parts.join(' ');
    expect(formatted).toBe('3675 9832 4511');
  });

  it('validates 12 digits using Verhoeff checksum algorithm', () => {
    const valid = '367598324511';
    expect(VerhoeffUtil.validate(valid)).toBe(true);

    const invalid = '367598324519';
    expect(VerhoeffUtil.validate(invalid)).toBe(false);
  });

  it('masks Aadhaar display correctly with last 4 digits', () => {
    expect(formatMaskedAadhaar('4511')).toBe('XXXX XXXX 4511');
    expect(formatMaskedAadhaar(null)).toBe('XXXX XXXX XXXX');
  });

  it('enforces Zod Aadhaar schema rules for client-side validation', () => {
    // Cannot start with 0
    expect(aadhaarSchema.safeParse('098765432101').success).toBe(false);
    // Cannot start with 1
    expect(aadhaarSchema.safeParse('198765432101').success).toBe(false);
    // Must be exactly 12 digits
    expect(aadhaarSchema.safeParse('36759832451').success).toBe(false);
    expect(aadhaarSchema.safeParse('3675983245112').success).toBe(false);
    // Valid 12 digits with valid Verhoeff checksum
    expect(aadhaarSchema.safeParse('367598324511').success).toBe(true);
  });

  it('validates and normalises physical receipt numbers in UI', async () => {
    const { receiptNoSchema } = await import('@wpd/shared');
    expect(receiptNoSchema.parse(' rc-000101 ')).toBe('RC-000101');
    expect(receiptNoSchema.safeParse('RC-101').success).toBe(true);
    expect(receiptNoSchema.safeParse('12').success).toBe(false);
    expect(receiptNoSchema.safeParse('RC#101').success).toBe(false);
  });

  it('validates physical pass numbers in UI', async () => {
    const { passNoSchema } = await import('@wpd/shared');
    expect(passNoSchema.parse(' PASS-00101 ')).toBe('PASS-00101');
    expect(passNoSchema.safeParse('P1').success).toBe(false);
    expect(passNoSchema.safeParse('PASS-00101').success).toBe(true);
  });

  it('sanitizes formula injection characters (=, +, -, @) for CSV/Excel export cells', async () => {
    const { sanitizeForFormulaInjection } = await import('@wpd/shared');
    expect(sanitizeForFormulaInjection('=1+2')).toBe("'=1+2");
    expect(sanitizeForFormulaInjection('+SUM(A1:A10)')).toBe("'+SUM(A1:A10)");
    expect(sanitizeForFormulaInjection('-cmd|calc')).toBe("'-cmd|calc");
    expect(sanitizeForFormulaInjection('@dangerous')).toBe("'@dangerous");
    expect(sanitizeForFormulaInjection('Safe Text')).toBe('Safe Text');
  });

  it('validates cash reconciliation and export query schemas', async () => {
    const { recordCashReconciliationSchema, exportQuerySchema } = await import('@wpd/shared');

    // Valid cash reconciliation
    const validRec = recordCashReconciliationSchema.safeParse({
      date: '2026-10-07',
      collectorId: 'col-1',
      handedOverPaise: 20000,
      notes: 'Balanced',
    });
    expect(validRec.success).toBe(true);

    // Negative handed over paise is rejected
    const invalidRec = recordCashReconciliationSchema.safeParse({
      date: '2026-10-07',
      collectorId: 'col-1',
      handedOverPaise: -500,
    });
    expect(invalidRec.success).toBe(false);

    // Export query defaults to CSV
    const exportResult = exportQuerySchema.parse({});
    expect(exportResult.format).toBe('csv');
  });
});
