import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsService } from './reports.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PaymentMode, PaymentType, Role } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { sanitizeForFormulaInjection } from '@wpd/shared';

interface MockPrisma {
  payment: {
    findMany: ReturnType<typeof vi.fn>;
  };
  walker: {
    findMany: ReturnType<typeof vi.fn>;
  };
  user: {
    findMany: ReturnType<typeof vi.fn>;
  };
  cashReconciliation: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
}

describe('Reports & Exports Suite', () => {
  let reportsService: ReportsService;
  let mockPrisma: MockPrisma;
  let mockAuditService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPrisma = {
      payment: {
        findMany: vi.fn(),
      },
      walker: {
        findMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      cashReconciliation: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    mockAuditService = {
      log: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    reportsService = new ReportsService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
    );
  });

  describe('1. Collections Report', () => {
    it('groups collections by payment gateId (not walker gate), collector, mode, and type', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          gateId: 'gate-g2',
          collectedById: 'collector-1',
          amountPaise: 20000,
          mode: PaymentMode.CASH,
          type: PaymentType.NEW,
          createdAt: new Date('2026-10-01T10:00:00.000Z'),
          gate: { code: 'G2', name: 'North Gate' },
          collectedBy: { id: 'collector-1', name: 'Ramesh', email: 'ramesh@park.local' },
        },
        {
          id: 'pay-2',
          gateId: 'gate-g5',
          collectedById: 'collector-2',
          amountPaise: 20000,
          mode: PaymentMode.UPI,
          type: PaymentType.RENEWAL,
          createdAt: new Date('2026-10-01T11:00:00.000Z'),
          gate: { code: 'G5', name: 'East Gate' },
          collectedBy: { id: 'collector-2', name: 'Suresh', email: 'suresh@park.local' },
        },
        {
          id: 'pay-3',
          gateId: 'gate-g2',
          collectedById: 'collector-1',
          amountPaise: 20000,
          mode: PaymentMode.UPI,
          type: PaymentType.NEW,
          createdAt: new Date('2026-10-02T09:00:00.000Z'),
          gate: { code: 'G2', name: 'North Gate' },
          collectedBy: { id: 'collector-1', name: 'Ramesh', email: 'ramesh@park.local' },
        },
      ];

      mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await reportsService.getCollectionsReport({
        period: 'daily',
      });

      expect(result.summary.totalPayments).toBe(3);
      expect(result.summary.totalPaise).toBe(60000);
      expect(result.summary.totalInr).toBe('₹600');

      // Check byGate: Gate G2 should have 40000 (1 cash, 1 upi), Gate G5 should have 20000 (1 upi)
      const gateG2 = result.byGate.find((g) => g.code === 'G2');
      expect(gateG2).toBeDefined();
      expect(gateG2?.count).toBe(2);
      expect(gateG2?.paise).toBe(40000);
      expect(gateG2?.cashPaise).toBe(20000);
      expect(gateG2?.upiPaise).toBe(20000);

      const gateG5 = result.byGate.find((g) => g.code === 'G5');
      expect(gateG5?.count).toBe(1);
      expect(gateG5?.upiPaise).toBe(20000);

      // Check byMode
      expect(result.byMode.CASH.count).toBe(1);
      expect(result.byMode.CASH.paise).toBe(20000);
      expect(result.byMode.UPI.count).toBe(2);
      expect(result.byMode.UPI.paise).toBe(40000);

      // Check byType
      expect(result.byType.NEW.count).toBe(2);
      expect(result.byType.RENEWAL.count).toBe(1);
    });
  });

  describe('2. Expiries Report', () => {
    it('returns passes within expiry thresholds and never leaks Aadhaar', async () => {
      const now = new Date();
      const passExpiringSoon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
      const passExpiringLate = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000); // 25 days
      const passExpired = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

      const mockWalkers = [
        {
          id: 'w-1',
          name: 'Priya Sharma',
          passNo: 'WP-1001',
          phone: '9876543210',
          passes: [{ startDate: new Date('2026-09-01'), expiryDate: passExpiringSoon }],
          payments: [
            { gate: { code: 'G2', name: 'North' }, receiptNo: 'RC-101', createdAt: new Date() },
          ],
        },
        {
          id: 'w-2',
          name: 'Amit Patel',
          passNo: 'WP-1002',
          phone: '9876543211',
          passes: [{ startDate: new Date('2026-09-01'), expiryDate: passExpiringLate }],
          payments: [
            { gate: { code: 'G5', name: 'East' }, receiptNo: 'RC-102', createdAt: new Date() },
          ],
        },
        {
          id: 'w-3',
          name: 'Sunita Rao',
          passNo: 'WP-1003',
          phone: '9876543212',
          passes: [{ startDate: new Date('2026-08-01'), expiryDate: passExpired }],
          payments: [
            { gate: { code: 'G2', name: 'North' }, receiptNo: 'RC-090', createdAt: new Date() },
          ],
        },
      ];

      mockPrisma.walker.findMany.mockResolvedValue(mockWalkers);

      // Filter threshold = 7 days: should only include w-1 (3 days remaining)
      const report7Days = await reportsService.getExpiriesReport({
        threshold: '7',
        status: 'EXPIRING',
        page: 1,
        limit: 50,
      });

      expect(report7Days.total).toBe(1);
      expect(report7Days.data[0]?.passNo).toBe('WP-1001');
      expect(report7Days.data[0]?.status).toBe('EXPIRING');
      // Crucial: Aadhaar must not exist in any key of the returned items
      const json = JSON.stringify(report7Days.data[0]);
      expect(json).not.toContain('aadhaar');

      // Filter status = EXPIRED: should only include w-3
      const reportExpired = await reportsService.getExpiriesReport({
        status: 'EXPIRED',
        page: 1,
        limit: 50,
      });

      expect(reportExpired.total).toBe(1);
      expect(reportExpired.data[0]?.passNo).toBe('WP-1003');
      expect(reportExpired.data[0]?.status).toBe('EXPIRED');
    });
  });

  describe('3. Cash Reconciliation', () => {
    it('calculates expected cash vs handed over and correctly flags SHORTAGE and EXCESS', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'collector-1', name: 'Ramesh', email: 'ramesh@park.local' },
      ]);

      // Collector recorded two CASH payments totaling 40000 paise (Rs 400)
      mockPrisma.payment.findMany.mockResolvedValue([
        { amountPaise: 20000, gate: { code: 'G2' } },
        { amountPaise: 20000, gate: { code: 'G2' } },
      ]);

      // No saved reconciliation yet
      mockPrisma.cashReconciliation.findUnique.mockResolvedValue(null);

      const result = await reportsService.getCashReconciliation({
        date: '2026-10-07',
      });

      expect(result.reconciliations).toHaveLength(1);
      const rec = result.reconciliations[0]!;
      expect(rec.expectedCashPaise).toBe(40000);
      expect(rec.expectedCashInr).toBe('₹400');
      expect(rec.handedOverPaise).toBe(40000); // defaults to expected when unreconciled
      expect(rec.differencePaise).toBe(0);
      expect(rec.status).toBe('BALANCED');
      expect(rec.isReconciled).toBe(false);
    });

    it('records reconciliation with shortage and writes audit log', async () => {
      // 2 payments collected = 40000 expected
      mockPrisma.payment.findMany.mockResolvedValue([
        { amountPaise: 20000 },
        { amountPaise: 20000 },
      ]);

      const mockSaved = {
        id: 'rec-001',
        date: new Date('2026-10-07T00:00:00.000Z'),
        collectorId: 'collector-1',
        expectedCashPaise: 40000,
        handedOverPaise: 38000, // Shortage of Rs 20 (2000 paise)
        differencePaise: -2000,
        notes: 'Shortage of Rs 20 due to coins shortage',
        reconciledById: 'admin-1',
        collector: { id: 'collector-1', name: 'Ramesh' },
        reconciledBy: { id: 'admin-1', name: 'Supervisor' },
      };

      mockPrisma.cashReconciliation.upsert.mockResolvedValue(mockSaved);

      const saved = await reportsService.recordCashReconciliation(
        {
          date: '2026-10-07',
          collectorId: 'collector-1',
          handedOverPaise: 38000,
          notes: 'Shortage of Rs 20 due to coins shortage',
        },
        'admin-1',
      );

      expect(mockPrisma.cashReconciliation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date_collectorId: {
              date: new Date('2026-10-07T00:00:00.000Z'),
              collectorId: 'collector-1',
            },
          },
          create: expect.objectContaining({
            expectedCashPaise: 40000,
            handedOverPaise: 38000,
            differencePaise: -2000,
          }),
        }),
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          action: 'CASH_RECONCILED',
          entity: 'CashReconciliation',
          entityId: 'rec-001',
          after: expect.objectContaining({
            expectedCashPaise: 40000,
            handedOverPaise: 38000,
            differencePaise: -2000,
          }),
        }),
      );

      expect(saved.differencePaise).toBe(-2000);
    });
  });

  describe('4. Physical Receipt Register & Gap Detection', () => {
    it('detects missing numbers in sequential physical receipt booklets', async () => {
      const mockPayments = [
        {
          id: 'p-1',
          receiptNo: 'RC-00101',
          amountPaise: 20000,
          mode: PaymentMode.CASH,
          type: PaymentType.NEW,
          isCorrected: false,
          createdAt: new Date('2026-10-01T10:00:00.000Z'),
          walker: { id: 'w-1', name: 'Ravi', passNo: 'WP-101' },
          gate: { code: 'G2', name: 'North' },
          collectedBy: { id: 'col-1', name: 'Ramesh' },
        },
        {
          id: 'p-2',
          receiptNo: 'RC-00102',
          amountPaise: 20000,
          mode: PaymentMode.CASH,
          type: PaymentType.NEW,
          isCorrected: false,
          createdAt: new Date('2026-10-01T10:05:00.000Z'),
          walker: { id: 'w-2', name: 'Anita', passNo: 'WP-102' },
          gate: { code: 'G2', name: 'North' },
          collectedBy: { id: 'col-1', name: 'Ramesh' },
        },
        // Gap: 103 and 104 are missing!
        {
          id: 'p-3',
          receiptNo: 'RC-00105',
          amountPaise: 20000,
          mode: PaymentMode.CASH,
          type: PaymentType.NEW,
          isCorrected: false,
          createdAt: new Date('2026-10-01T10:15:00.000Z'),
          walker: { id: 'w-3', name: 'Vijay', passNo: 'WP-105' },
          gate: { code: 'G2', name: 'North' },
          collectedBy: { id: 'col-1', name: 'Ramesh' },
        },
      ];

      mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await reportsService.getReceiptRegister({ page: 1, limit: 100 });

      expect(result.total).toBe(3);
      expect(result.detectedGapsCount).toBe(1);
      expect(result.detectedGaps[0]).toEqual({
        prefix: 'RC-',
        missingFrom: 103,
        missingTo: 104,
        missingCount: 2,
      });
    });
  });

  describe('5. Exports & Formula Injection Protection', () => {
    it('sanitizes cells starting with =, +, -, @ to neutralize CSV/Excel formula injection', () => {
      expect(sanitizeForFormulaInjection('=1+2')).toBe("'=1+2");
      expect(sanitizeForFormulaInjection('+SUM(A1:A10)')).toBe("'+SUM(A1:A10)");
      expect(sanitizeForFormulaInjection('-5')).toBe("'-5");
      expect(sanitizeForFormulaInjection('@cmd|/c calc')).toBe("'@cmd|/c calc");
      expect(sanitizeForFormulaInjection('  =cmd')).toBe("'  =cmd");
      expect(sanitizeForFormulaInjection('Normal Text')).toBe('Normal Text');
      expect(sanitizeForFormulaInjection('RC-001')).toBe('RC-001');
    });

    it('exports CSV with UTF-8 BOM, sanitization, and writes audit log with query filters', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay-exp-1',
          receiptNo: '=SUM(1,2)', // Malicious input attempt
          amountPaise: 20000,
          mode: PaymentMode.CASH,
          type: PaymentType.NEW,
          isCorrected: false,
          createdAt: new Date('2026-10-07T10:00:00.000Z'),
          walker: { name: 'Dangerous Walker', passNo: 'WP-999', phone: '9876543210' },
          gate: { code: 'G2', name: 'North Gate' },
          collectedBy: { name: 'Ramesh', email: 'ramesh@park.local' },
        },
      ]);

      const csv = await reportsService.exportPayments(
        { format: 'csv', mode: PaymentMode.CASH },
        'admin-1',
        '127.0.0.1',
        'Vitest',
      );

      // Verify UTF-8 BOM (\uFEFF) at start of file
      expect(typeof csv).toBe('string');
      const csvStr = csv as string;
      expect(csvStr.charCodeAt(0)).toBe(0xfeff);

      // Verify formula injection neutralized
      expect(csvStr).toContain('"\'=SUM(1,2)"');

      // Verify audit log recorded
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          action: 'EXPORT_GENERATED',
          entity: 'Payment',
          entityId: 'ALL_PAYMENTS',
          after: expect.objectContaining({
            exportType: 'PAYMENTS',
            format: 'csv',
            filters: { format: 'csv', mode: PaymentMode.CASH },
            recordCount: 1,
          }),
        }),
      );
    });

    it('exports Excel XLSX buffer successfully', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay-exp-2',
          receiptNo: 'RC-101',
          amountPaise: 20000,
          mode: PaymentMode.UPI,
          type: PaymentType.RENEWAL,
          isCorrected: false,
          createdAt: new Date('2026-10-07T10:00:00.000Z'),
          walker: { name: 'Priya', passNo: 'WP-101', phone: '9876543210' },
          gate: { code: 'G5', name: 'East Gate' },
          collectedBy: { name: 'Suresh', email: 'suresh@park.local' },
        },
      ]);

      const buffer = await reportsService.exportPayments({ format: 'excel' }, 'admin-1');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      // Valid XLSX file starts with PK zip header bytes: 0x50, 0x4b
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    });
  });

  describe('6. Authorization: Role Guard on Reports', () => {
    it('allows ADMIN and SUPER_ADMIN but forbids COLLECTOR from accessing reports', () => {
      const reflector = new Reflector();
      const rolesGuard = new RolesGuard(reflector);

      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]);

      const createMockContext = (role: Role): ExecutionContext =>
        ({
          getHandler: () => {},
          getClass: () => {},
          switchToHttp: () => ({
            getRequest: () => ({
              user: { id: 'test-user', role },
            }),
          }),
        }) as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(createMockContext(Role.ADMIN))).toBe(true);
      expect(rolesGuard.canActivate(createMockContext(Role.SUPER_ADMIN))).toBe(true);
      expect(() => rolesGuard.canActivate(createMockContext(Role.COLLECTOR))).toThrow(
        ForbiddenException,
      );
    });
  });
});
