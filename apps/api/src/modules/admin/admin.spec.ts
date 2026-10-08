import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminService } from './admin.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('Admin Dashboard, Staff & Settings Suite', () => {
  let adminService: AdminService;
  let prisma: any;
  let auditService: any;

  beforeEach(() => {
    prisma = {
      pass: {
        count: vi.fn(),
      },
      payment: {
        aggregate: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      gate: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      walker: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      user: {
        count: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      setting: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      auditLog: {
        count: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      refreshToken: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((promises) => Promise.all(promises)),
    };

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    adminService = new AdminService(prisma as unknown as PrismaService, auditService as unknown as AuditService);
  });

  describe('1. Dashboard Overview Analytics', () => {
    it('calculates KPI metrics, deltas, and 4 chart datasets correctly', async () => {
      // Mock Pass counts
      prisma.pass.count
        .mockResolvedValueOnce(120) // activeWalkers
        .mockResolvedValueOnce(100) // prevActiveWalkers
        .mockResolvedValueOnce(15)  // expiringSoon
        .mockResolvedValueOnce(8);  // expiredPasses

      // Mock Payment aggregates
      prisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amountPaise: 40000 } }) // today
        .mockResolvedValueOnce({ _sum: { amountPaise: 30000 } }) // yesterday
        .mockResolvedValueOnce({ _sum: { amountPaise: 500000 } }) // this month
        .mockResolvedValueOnce({ _sum: { amountPaise: 400000 } }); // last month

      // Mock Payment counts (new vs renewal)
      prisma.payment.count
        .mockResolvedValueOnce(18) // new passes this month
        .mockResolvedValueOnce(12); // renewal passes this month

      // Mock Range payments for trends
      const mockRangePayments = [
        {
          amountPaise: 20000,
          mode: 'CASH',
          type: 'NEW',
          gateId: 'gate-1',
          createdAt: new Date('2026-10-07T08:00:00Z'),
        },
        {
          amountPaise: 20000,
          mode: 'UPI',
          type: 'RENEWAL',
          gateId: 'gate-2',
          createdAt: new Date('2026-10-07T09:00:00Z'),
        },
      ];
      prisma.payment.findMany.mockResolvedValue(mockRangePayments);

      // Mock Gates
      prisma.gate.findMany.mockResolvedValue([
        { id: 'gate-1', code: 'G2', name: 'Main North Gate' },
        { id: 'gate-2', code: 'GS', name: 'South Gate' },
      ]);

      // Mock Walker group by gate
      prisma.walker.groupBy.mockResolvedValue([
        { gateId: 'gate-1', _count: { id: 70 } },
        { gateId: 'gate-2', _count: { id: 50 } },
      ]);

      const dashboard = await adminService.getDashboard({ range: '7d' });

      expect(dashboard).toBeDefined();
      expect(dashboard.kpis.activeWalkers.count).toBe(120);
      expect(dashboard.kpis.activeWalkers.changePct).toBe(20); // (120 - 100) / 100 * 100 = 20%
      expect(dashboard.kpis.todayCollectionPaise.amount).toBe(40000);
      expect(dashboard.kpis.monthCollectionPaise.amount).toBe(500000);
      expect(dashboard.kpis.newVsRenewalThisMonth.newCount).toBe(18);
      expect(dashboard.kpis.newVsRenewalThisMonth.renewalCount).toBe(12);
      expect(dashboard.kpis.newVsRenewalThisMonth.ratioPct).toBe(60); // 18 / 30 = 60%

      // Verify Chart Datasets
      expect(dashboard.collectionsTrend.length).toBeGreaterThan(0);
      expect(dashboard.gateComparison.length).toBe(2);
      expect(dashboard.paymentModeSplit.cashPaise).toBe(20000);
      expect(dashboard.paymentModeSplit.upiPaise).toBe(20000);
      expect(dashboard.registrationsOverTime.length).toBeGreaterThan(0);
    });
  });

  describe('2. Staff & User Management', () => {
    it('lists users without exposing password hashes or totp secrets', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          name: 'Ramesh Patel',
          email: 'ramesh@park.gov.in',
          phone: '9845011111',
          role: 'COLLECTOR',
          status: 'ACTIVE',
          failedLogins: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          totpSecret: 'encrypted-secret-string',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await adminService.listUsers({ page: 1, limit: 20 });
      expect(result.total).toBe(1);
      expect(result.data[0].has2FA).toBe(true);
      expect((result.data[0] as any).totpSecret).toBeUndefined();
      expect((result.data[0] as any).passwordHash).toBeUndefined();
    });

    it('creates a new collector user and writes an audit log', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        name: 'Sunita Rao',
        email: 'sunita@park.gov.in',
        phone: '9845022222',
        role: 'COLLECTOR',
        status: 'ACTIVE',
        createdAt: new Date(),
      });

      const newUser = await adminService.createUser(
        {
          name: 'Sunita Rao',
          email: 'sunita@park.gov.in',
          phone: '9845022222',
          role: 'COLLECTOR',
          password: 'Password123!',
        },
        'admin-id',
        '127.0.0.1',
      );

      expect(newUser.id).toBe('new-user-id');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_USER',
          actorId: 'admin-id',
          entity: 'User',
        }),
      );
    });

    it('updates user status to DISABLED and writes audit log', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Ramesh',
        status: 'ACTIVE',
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        name: 'Ramesh',
        status: 'DISABLED',
      });

      const updated = await adminService.updateUserStatus(
        'user-1',
        { status: 'DISABLED', reason: 'Shift reassigned' },
        'admin-id',
      );

      expect(updated.status).toBe('DISABLED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_USER_STATUS',
          actorId: 'admin-id',
        }),
      );
    });

    it('resets user password and invalidates active refresh tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      const res = await adminService.resetUserPassword(
        'user-1',
        { newPassword: 'BrandNewPass123!' },
        'admin-id',
      );

      expect(res.success).toBe(true);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { revoked: true },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADMIN_RESET_PASSWORD',
          actorId: 'admin-id',
        }),
      );
    });
  });

  describe('3. Gates & Settings Management', () => {
    it('retrieves default or configured system settings', async () => {
      prisma.setting.findMany.mockResolvedValue([
        { key: 'PASS_PRICE_PAISE', value: '25000' },
        { key: 'PASS_VALIDITY_DAYS', value: '45' },
      ]);

      const settings = await adminService.getSettings();
      expect(settings.passPricePaise).toBe(25000);
      expect(settings.validityDays).toBe(45);
      expect(settings.expiringThresholdDays).toBe(7); // default
    });

    it('updates settings and writes audit log', async () => {
      prisma.setting.findMany.mockResolvedValue([]);
      prisma.setting.upsert.mockResolvedValue({});

      await adminService.updateSettings(
        { passPricePaise: 22000, validityDays: 30 },
        'admin-id',
      );

      expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_SETTINGS',
          actorId: 'admin-id',
        }),
      );
    });
  });
});
