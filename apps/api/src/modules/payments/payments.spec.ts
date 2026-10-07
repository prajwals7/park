import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentMode, Role } from '@prisma/client';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ExecutionContext } from '@nestjs/common';

interface MockPaymentPrisma {
  payment: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
}

describe('Payments & Admin Payment Correction Suite', () => {
  let paymentsService: PaymentsService;
  let mockPrisma: MockPaymentPrisma;

  const mockExistingPayment = {
    id: 'pay-001',
    walkerId: 'walker-101',
    passId: 'pass-201',
    gateId: 'gate-g2',
    collectedById: 'collector-1',
    amountPaise: 20000,
    mode: PaymentMode.CASH,
    type: 'NEW',
    receiptNo: 'RC-000101',
    isCorrected: false,
    correctionReason: null,
    correctedAt: null,
    correctedById: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
  };

  beforeEach(() => {
    mockPrisma = {
      payment: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    };

    paymentsService = new PaymentsService(mockPrisma as unknown as PrismaService);
  });

  describe('Admin Payment Correction', () => {
    it('successfully updates physical receipt number and mode, writes audit log, and keeps original row', async () => {
      mockPrisma.payment.findUnique
        .mockResolvedValueOnce(mockExistingPayment) // find existing
        .mockResolvedValueOnce(null); // check uniqueness of target receipt number (none exists)

      const updatedPayment = {
        ...mockExistingPayment,
        receiptNo: 'RC-000102',
        mode: PaymentMode.UPI,
        isCorrected: true,
        correctionReason: 'Typo in receipt paper slip number',
        correctedAt: new Date(),
        correctedById: 'admin-1',
      };
      mockPrisma.payment.update.mockResolvedValue(updatedPayment);

      const result = await paymentsService.correctPayment(
        'pay-001',
        {
          receiptNo: 'rc-000102', // Lowercase input -> should be upper-cased
          mode: PaymentMode.UPI,
          reason: 'Typo in receipt paper slip number',
        },
        'admin-1',
        '127.0.0.1',
        'Vitest-Agent',
      );

      // Verify trigger authorization was set
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        `SET LOCAL app.allow_payment_correction = 'on'`,
      );

      // Verify update payload keeps original row and modifies only permitted fields
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-001' },
          data: expect.objectContaining({
            receiptNo: 'RC-000102',
            mode: PaymentMode.UPI,
            isCorrected: true,
            correctionReason: 'Typo in receipt paper slip number',
            correctedById: 'admin-1',
          }),
        }),
      );

      // Verify before & after state recorded in audit log
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-1',
          action: 'CORRECT_PAYMENT',
          entity: 'Payment',
          entityId: 'pay-001',
          before: {
            receiptNo: 'RC-000101',
            mode: PaymentMode.CASH,
            isCorrected: false,
          },
          after: expect.objectContaining({
            receiptNo: 'RC-000102',
            mode: PaymentMode.UPI,
            reason: 'Typo in receipt paper slip number',
            isCorrected: true,
          }),
          ip: '127.0.0.1',
          userAgent: 'Vitest-Agent',
        }),
      });

      expect(result.receiptNo).toBe('RC-000102');
      expect(result.isCorrected).toBe(true);
    });

    it('rejects correction if target payment record does not exist (404 Not Found)', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        paymentsService.correctPayment(
          'non-existent-pay',
          {
            receiptNo: 'RC-000999',
            reason: 'Correction attempt',
          },
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects correction if target physical receipt number is already taken (409 Conflict)', async () => {
      mockPrisma.payment.findUnique
        .mockResolvedValueOnce(mockExistingPayment) // find existing
        .mockResolvedValueOnce({ id: 'pay-002', receiptNo: 'RC-000999' }); // another payment has RC-000999

      await expect(
        paymentsService.correctPayment(
          'pay-001',
          {
            receiptNo: 'RC-000999',
            reason: 'Trying to use already existing receipt number',
          },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Authorization: Role Guard Enforcement', () => {
    it('allows ADMIN and SUPER_ADMIN but forbids COLLECTOR from correcting payments', () => {
      const reflector = new Reflector();
      const rolesGuard = new RolesGuard(reflector);

      // Set roles on the route handler as defined on PaymentsController.correctPayment
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

      // ADMIN allowed
      expect(rolesGuard.canActivate(createMockContext(Role.ADMIN))).toBe(true);
      // SUPER_ADMIN allowed
      expect(rolesGuard.canActivate(createMockContext(Role.SUPER_ADMIN))).toBe(true);
      // COLLECTOR strictly forbidden with ForbiddenException
      expect(() => rolesGuard.canActivate(createMockContext(Role.COLLECTOR))).toThrow(
        ForbiddenException,
      );
    });
  });
});
