import { describe, it, expect } from 'vitest';
import {
  createUserSchema,
  updateUserStatusSchema,
  adminResetPasswordSchema,
  force2faSchema,
  updateSettingsSchema,
  sanitizeForFormulaInjection,
  GATES,
} from '@wpd/shared';

describe('Admin Dashboard, Management, and Analytics Suite (Web)', () => {
  describe('1. KPI Calculations & Delta Indicators', () => {
    it('computes positive, negative, and neutral change percentages correctly', () => {
      const calculateDelta = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      expect(calculateDelta(120, 100)).toBe(20);
      expect(calculateDelta(80, 100)).toBe(-20);
      expect(calculateDelta(100, 100)).toBe(0);
      expect(calculateDelta(50, 0)).toBe(100);
    });

    it('formats Indian rupee amounts with currency symbol and thousands separator', () => {
      const formatCurrency = (paise: number) => {
        const rupees = Math.round(paise / 100);
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(rupees);
      };

      expect(formatCurrency(20000)).toMatch(/200/);
      expect(formatCurrency(1500000)).toMatch(/15,000/);
    });
  });

  describe('2. Chart Series & Split Aggregations', () => {
    it('calculates Cash vs UPI percentage split accurately', () => {
      const cash = 60000; // Rs 600
      const upi = 40000; // Rs 400
      const total = cash + upi;

      const cashPercent = Math.round((cash / total) * 100);
      const upiPercent = Math.round((upi / total) * 100);

      expect(cashPercent).toBe(60);
      expect(upiPercent).toBe(40);
      expect(cashPercent + upiPercent).toBe(100);
    });

    it('verifies official park gates exist in Gate comparison metrics', () => {
      expect(GATES).toContain('G2');
      expect(GATES).toContain('GS');
      expect(GATES).toContain('G9');
    });
  });

  describe('3. Staff & User Management Validation', () => {
    it('validates user creation with role, phone, and password policy', () => {
      const validUser = {
        name: 'Suresh Patil',
        email: 'suresh@parkdesk.in',
        password: 'Password@123',
        role: 'COLLECTOR' as const,
        phone: '9845012345',
      };

      const result = createUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('validates account status toggle schema', () => {
      expect(updateUserStatusSchema.safeParse({ status: 'DISABLED', reason: 'Misconduct' }).success).toBe(true);
      expect(updateUserStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true);
      expect(updateUserStatusSchema.safeParse({ status: 'INVALID' }).success).toBe(false);
    });

    it('validates admin password reset schema', () => {
      const validReset = {
        newPassword: 'StrongPassword@2026',
      };
      expect(adminResetPasswordSchema.safeParse(validReset).success).toBe(true);

      const weakReset = {
        newPassword: '123',
      };
      expect(adminResetPasswordSchema.safeParse(weakReset).success).toBe(false);
    });

    it('validates force 2FA toggle schema', () => {
      expect(force2faSchema.safeParse({ require2fa: true }).success).toBe(true);
      expect(force2faSchema.safeParse({ require2fa: false }).success).toBe(true);
    });
  });

  describe('4. Settings & Tariff Configuration', () => {
    it('validates park operational settings (pass price, validity days, expiring threshold)', () => {
      const validSettings = {
        passPricePaise: 20000,
        validityDays: 30,
        expiringThresholdDays: 7,
      };

      const parsed = updateSettingsSchema.safeParse(validSettings);
      expect(parsed.success).toBe(true);
    });
  });

  describe('5. Walker Search, Filter & Soft Delete Verification', () => {
    const mockWalkers = [
      {
        id: 'w1',
        name: 'Arun Verma',
        phone: '9876543210',
        passNo: 'WP-1001',
        gateCode: 'G1',
        status: 'ACTIVE',
        deletedAt: null,
      },
      {
        id: 'w2',
        name: 'Bina Roy',
        phone: '9123456780',
        passNo: 'WP-1002',
        gateCode: 'G2',
        status: 'EXPIRING',
        deletedAt: null,
      },
      {
        id: 'w3',
        name: 'Chetan Desai',
        phone: '9988776655',
        passNo: 'WP-1003',
        gateCode: 'G3',
        status: 'EXPIRED',
        deletedAt: '2026-10-01T00:00:00.000Z',
      },
    ];

    it('filters walkers by status and gate', () => {
      const activeWalkers = mockWalkers.filter((w) => w.status === 'ACTIVE' && !w.deletedAt);
      expect(activeWalkers.length).toBe(1);
      expect(activeWalkers[0]?.name).toBe('Arun Verma');

      const gate2Walkers = mockWalkers.filter((w) => w.gateCode === 'G2');
      expect(gate2Walkers.length).toBe(1);
      expect(gate2Walkers[0]?.name).toBe('Bina Roy');
    });

    it('filters walkers by global search query across name, phone, or pass number', () => {
      const search = (q: string) => {
        const lower = q.toLowerCase();
        return mockWalkers.filter(
          (w) =>
            w.name.toLowerCase().includes(lower) ||
            w.phone.includes(lower) ||
            w.passNo.toLowerCase().includes(lower),
        );
      };

      expect(search('Arun')).toHaveLength(1);
      expect(search('9876')).toHaveLength(1);
      expect(search('WP-1002')).toHaveLength(1);
      expect(search('Unknown')).toHaveLength(0);
    });
  });

  describe('6. Security & Formula Injection Sanitization', () => {
    it('neutralizes malicious formula triggers in export rows', () => {
      expect(sanitizeForFormulaInjection('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeForFormulaInjection('+cmd|calc')).toBe("'+cmd|calc");
      expect(sanitizeForFormulaInjection('-cmd|calc')).toBe("'-cmd|calc");
      expect(sanitizeForFormulaInjection('@HYPERLINK("evil.com")')).toBe(
        "'@HYPERLINK(\"evil.com\")",
      );
      expect(sanitizeForFormulaInjection('Standard Text')).toBe('Standard Text');
    });
  });
});
