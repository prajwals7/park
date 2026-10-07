import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalkersService } from './walkers.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { calculateRenewalExpiry, calculateNewPassExpiry } from '@wpd/shared';

interface MockWalkerPrisma {
  walker: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  pass: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  payment: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  document: {
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
}

describe('Walkers & Pass Management Suite', () => {
  let walkersService: WalkersService;
  let mockPrisma: MockWalkerPrisma;
  let mockAuditService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPrisma = {
      walker: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      pass: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      payment: {
        count: vi.fn(),
        create: vi.fn(),
      },
      document: {
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
      $queryRaw: vi.fn(),
    };

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    walkersService = new WalkersService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
    );
  });

  describe('Business Rule: Pass Validity & Expiry Edge Cases', () => {
    it('calculates 30 days from today for new pass registration', () => {
      const today = new Date('2026-10-07T00:00:00.000Z');
      const expiry = calculateNewPassExpiry(today);
      expect(expiry.toISOString()).toBe('2026-11-06T00:00:00.000Z');
    });

    it('handles edge case: renewal with 0 days left (expiring today)', () => {
      const today = new Date('2026-10-07T12:00:00.000Z');
      const expiringToday = new Date('2026-10-07T10:00:00.000Z');
      // max(today, expiringToday) = today -> today + 30 days
      const renewed = calculateRenewalExpiry(expiringToday, today);
      const diffDays = Math.round((renewed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it('handles edge case: renewal for pass expired long ago (e.g. 60 days ago)', () => {
      const today = new Date('2026-10-07T00:00:00.000Z');
      const expiredLongAgo = new Date('2026-08-01T00:00:00.000Z');
      // max(today, expiredLongAgo) = today -> today + 30 days = 2026-11-06
      const renewed = calculateRenewalExpiry(expiredLongAgo, today);
      expect(renewed.toISOString()).toBe('2026-11-06T00:00:00.000Z');
    });

    it('handles edge case: renewal on the exact same day of registration / current expiry far ahead', () => {
      const today = new Date('2026-10-07T00:00:00.000Z');
      const currentExpiryInFuture = new Date('2026-10-27T00:00:00.000Z'); // 20 days ahead
      // max(today, currentExpiry) = 2026-10-27 -> 2026-11-26
      const renewed = calculateRenewalExpiry(currentExpiryInFuture, today);
      expect(renewed.toISOString()).toBe('2026-11-26T00:00:00.000Z');
    });
  });

  describe('Duplicate Checking & Constraints', () => {
    it('rejects registration when passNo already exists', async () => {
      mockPrisma.walker.findUnique.mockResolvedValue({
        id: 'w-1',
        passNo: 'WPD-2026-1001',
        name: 'Existing Walker',
      });

      await expect(
        walkersService.createWalker(
          {
            passNo: 'WPD-2026-1001',
            name: 'New Walker',
            phone: '9845012345',
            gateId: '11111111-1111-1111-1111-111111111111',
            aadhaarNumber: '367598324510',
            consentAgreed: true,
            aadhaarStorageKey: 'docs/aadhaar.jpg',
            passportStorageKey: 'docs/photo.jpg',
            paymentMode: 'CASH',
            allowDuplicatePhoneOverride: false,
          },
          'collector-1',
          Role.COLLECTOR,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('blocks duplicate phone for COLLECTOR even if override is requested', async () => {
      mockPrisma.walker.findUnique.mockResolvedValue(null);
      mockPrisma.walker.findFirst.mockResolvedValue({
        id: 'w-existing',
        phone: '9845012345',
        name: 'Existing Person',
        passNo: 'WPD-2026-9999',
      });

      await expect(
        walkersService.createWalker(
          {
            passNo: 'WPD-2026-1002',
            name: 'Duplicate Phone Person',
            phone: '9845012345',
            gateId: '11111111-1111-1111-1111-111111111111',
            aadhaarNumber: '367598324510',
            consentAgreed: true,
            aadhaarStorageKey: 'docs/aadhaar.jpg',
            passportStorageKey: 'docs/photo.jpg',
            paymentMode: 'CASH',
            allowDuplicatePhoneOverride: true,
            overrideReason: 'Family member sharing mobile phone',
          },
          'collector-1',
          Role.COLLECTOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Idempotency & Double Charge Protection', () => {
    it('prevents double charge when retried with identical idempotency key', async () => {
      mockPrisma.walker.findUnique.mockResolvedValue(null);
      mockPrisma.walker.findFirst.mockResolvedValue(null);
      mockPrisma.payment.count.mockResolvedValue(10);
      mockPrisma.walker.create.mockResolvedValue({
        id: 'w-new',
        passNo: 'WPD-2026-1050',
        name: 'Unique Person',
        phone: '9845099999',
      });
      mockPrisma.pass.create.mockResolvedValue({
        id: 'p-new',
        expiryDate: new Date('2026-11-06T00:00:00.000Z'),
      });
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-new',
        receiptNo: 'RCP-2026-000011',
        amountPaise: 20000,
        mode: 'UPI',
        createdAt: new Date(),
      });

      const idempotencyKey = 'idemp-key-unique-test-123';
      const input = {
        passNo: 'WPD-2026-1050',
        name: 'Unique Person',
        phone: '9845099999',
        gateId: '11111111-1111-1111-1111-111111111111',
        aadhaarNumber: '367598324510',
        consentAgreed: true as const,
        aadhaarStorageKey: 'docs/aadhaar.jpg',
        passportStorageKey: 'docs/photo.jpg',
        paymentMode: 'UPI' as const,
        allowDuplicatePhoneOverride: false,
      };

      // First call -> executes transaction
      const firstResult = await walkersService.createWalker(
        input,
        'collector-1',
        Role.COLLECTOR,
        idempotencyKey,
      );
      expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);

      // Immediate retry with identical key -> returns cached result, no extra payment!
      const secondResult = await walkersService.createWalker(
        input,
        'collector-1',
        Role.COLLECTOR,
        idempotencyKey,
      );
      expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);
      expect(secondResult).toEqual(firstResult);
    });
  });

  describe('Renewal Concurrency & Row Locking', () => {
    it('executes row lock query during pass renewal', async () => {
      const walkerId = '22222222-2222-2222-2222-222222222222';
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: walkerId, name: 'Locked Walker', deletedAt: null },
      ]);
      mockPrisma.pass.findFirst.mockResolvedValue({
        id: 'pass-old',
        expiryDate: new Date('2026-10-15T00:00:00.000Z'),
      });
      mockPrisma.pass.create.mockResolvedValue({
        id: 'pass-renewed',
      });
      mockPrisma.document.create.mockResolvedValue({ id: 'doc-ticket' });
      mockPrisma.payment.count.mockResolvedValue(5);
      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-renewed',
        receiptNo: 'RCP-2026-000006',
        amountPaise: 20000,
        mode: 'CASH',
        createdAt: new Date(),
      });

      const res = (await walkersService.renewWalkerPass(
        walkerId,
        {
          gateId: '11111111-1111-1111-1111-111111111111',
          paymentMode: 'CASH',
          ticketStorageKey: 'docs/ticket_scan.jpg',
        },
        'collector-1',
      )) as { walker: { id: string }; payment: { receiptNo: string } };

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(res.walker.id).toBe(walkerId);
      expect(res.payment.receiptNo).toBe('RCP-2026-000006');
    });

    it('rejects renewal if walker is soft-deleted', async () => {
      const walkerId = '33333333-3333-3333-3333-333333333333';
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: walkerId, name: 'Deleted Walker', deletedAt: new Date() },
      ]);

      await expect(
        walkersService.renewWalkerPass(
          walkerId,
          {
            gateId: '11111111-1111-1111-1111-111111111111',
            paymentMode: 'CASH',
            ticketStorageKey: 'docs/ticket_scan.jpg',
          },
          'collector-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
