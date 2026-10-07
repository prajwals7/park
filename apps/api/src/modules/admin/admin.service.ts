import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CryptoUtil } from '../../common/utils/crypto.util.js';
import {
  CreateUserInput,
  UpdateUserStatusInput,
  AdminResetPasswordInput,
  Force2faInput,
  ListUsersQueryInput,
  CreateGateInput,
  UpdateGateInput,
  UpdateSettingsInput,
  DashboardOverviewQueryInput,
  DashboardOverviewResponse,
  PASS_CONFIG,
} from '@wpd/shared';
import { Prisma, Role, UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // =========================================================================
  // 1. Dashboard Overview Analytics (KPI Cards + 4 Data Series)
  // =========================================================================
  async getDashboard(query: DashboardOverviewQueryInput): Promise<DashboardOverviewResponse> {
    const now = new Date();

    // Determine current period date range
    let startDate: Date;
    let endDate: Date = now;

    if (query.range === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (query.range === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (query.range === 'custom' && query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      // Default '7d'
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const prevEndDate = startDate;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonthEquivalent = new Date(
      startOfLastMonth.getTime() + (now.getTime() - startOfMonth.getTime()),
    );

    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Queries in parallel
    const [
      activeWalkersCount,
      prevActiveWalkersCount,
      expiringSoonCount,
      expiredPassesCount,
      todayPayments,
      yesterdayPayments,
      monthPayments,
      lastMonthPayments,
      newThisMonthCount,
      renewalThisMonthCount,
      rangePayments,
      allGates,
      allWalkersWithGate,
    ] = await Promise.all([
      // 1. Active walkers now
      this.prisma.pass.count({
        where: {
          status: 'ACTIVE',
          expiryDate: { gte: now },
        },
      }),
      // 2. Active walkers previous period
      this.prisma.pass.count({
        where: {
          status: 'ACTIVE',
          expiryDate: { gte: prevEndDate },
          createdAt: { lte: prevEndDate },
        },
      }),
      // 3. Expiring soon (next 7 days)
      this.prisma.pass.count({
        where: {
          status: { in: ['ACTIVE', 'EXPIRING'] },
          expiryDate: { gte: now, lte: sevenDaysFromNow },
        },
      }),
      // 4. Expired passes
      this.prisma.pass.count({
        where: {
          OR: [{ status: 'EXPIRED' }, { expiryDate: { lt: now } }],
        },
      }),
      // 5. Today's collections
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: startOfToday } },
        _sum: { amountPaise: true },
      }),
      // 6. Yesterday's collections
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: startOfYesterday, lt: startOfToday } },
        _sum: { amountPaise: true },
      }),
      // 7. This month's collections
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amountPaise: true },
      }),
      // 8. Last month's collections (comparable period)
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: startOfLastMonth, lt: endOfLastMonthEquivalent } },
        _sum: { amountPaise: true },
      }),
      // 9. New passes this month
      this.prisma.payment.count({
        where: { type: 'NEW', createdAt: { gte: startOfMonth } },
      }),
      // 10. Renewal passes this month
      this.prisma.payment.count({
        where: { type: 'RENEWAL', createdAt: { gte: startOfMonth } },
      }),
      // 11. Payments in selected range for trends
      this.prisma.payment.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          ...(query.gateId ? { gateId: query.gateId } : {}),
        },
        select: {
          amountPaise: true,
          mode: true,
          type: true,
          gateId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      // 12. Gates list
      this.prisma.gate.findMany({
        select: { id: true, code: true, name: true },
      }),
      // 13. Walkers count by gate
      this.prisma.walker.groupBy({
        by: ['gateId'],
        _count: { id: true },
        where: { deletedAt: null },
      }),
    ]);

    // Calculate KPI Deltas
    const calcPct = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const todayAmount = todayPayments._sum.amountPaise || 0;
    const yesterdayAmount = yesterdayPayments._sum.amountPaise || 0;
    const monthAmount = monthPayments._sum.amountPaise || 0;
    const lastMonthAmount = lastMonthPayments._sum.amountPaise || 0;

    const totalMonthPasses = newThisMonthCount + renewalThisMonthCount;
    const newRatioPct =
      totalMonthPasses > 0 ? Math.round((newThisMonthCount / totalMonthPasses) * 100) : 0;

    const kpis = {
      activeWalkers: {
        count: activeWalkersCount,
        changePct: calcPct(activeWalkersCount, prevActiveWalkersCount),
      },
      expiringSoon: {
        count: expiringSoonCount,
        changePct: 0,
      },
      expiredPasses: {
        count: expiredPassesCount,
        changePct: 0,
      },
      todayCollectionPaise: {
        amount: todayAmount,
        changePct: calcPct(todayAmount, yesterdayAmount),
      },
      monthCollectionPaise: {
        amount: monthAmount,
        changePct: calcPct(monthAmount, lastMonthAmount),
      },
      newVsRenewalThisMonth: {
        newCount: newThisMonthCount,
        renewalCount: renewalThisMonthCount,
        ratioPct: newRatioPct,
        changePct: calcPct(newThisMonthCount, renewalThisMonthCount),
      },
    };

    // Calculate Trend & Split series
    const dailyMap = new Map<
      string,
      { totalPaise: number; cashPaise: number; upiPaise: number; count: number; newCount: number; renewCount: number }
    >();

    let totalCashPaise = 0;
    let totalCashCount = 0;
    let totalUpiPaise = 0;
    let totalUpiCount = 0;

    const gatePaymentMap = new Map<string, { totalPaise: number; count: number }>();

    for (const p of rangePayments) {
      const dateKey = p.createdAt.toISOString().slice(0, 10);
      const curr = dailyMap.get(dateKey) || {
        totalPaise: 0,
        cashPaise: 0,
        upiPaise: 0,
        count: 0,
        newCount: 0,
        renewCount: 0,
      };

      curr.totalPaise += p.amountPaise;
      curr.count += 1;
      if (p.mode === 'CASH') {
        curr.cashPaise += p.amountPaise;
        totalCashPaise += p.amountPaise;
        totalCashCount += 1;
      } else {
        curr.upiPaise += p.amountPaise;
        totalUpiPaise += p.amountPaise;
        totalUpiCount += 1;
      }

      if (p.type === 'NEW') {
        curr.newCount += 1;
      } else {
        curr.renewCount += 1;
      }

      dailyMap.set(dateKey, curr);

      const gp = gatePaymentMap.get(p.gateId) || { totalPaise: 0, count: 0 };
      gp.totalPaise += p.amountPaise;
      gp.count += 1;
      gatePaymentMap.set(p.gateId, gp);
    }

    const collectionsTrend = Array.from(dailyMap.entries()).map(([date, d]) => ({
      date,
      totalPaise: d.totalPaise,
      cashPaise: d.cashPaise,
      upiPaise: d.upiPaise,
      count: d.count,
    }));

    const registrationsOverTime = Array.from(dailyMap.entries()).map(([date, d]) => ({
      date,
      registrations: d.newCount,
      renewals: d.renewCount,
    }));

    const walkerGateCountMap = new Map(allWalkersWithGate.map((w) => [w.gateId, w._count.id]));

    const gateComparison = allGates.map((g) => {
      const pay = gatePaymentMap.get(g.id) || { totalPaise: 0, count: 0 };
      return {
        gateCode: g.code,
        gateName: g.name,
        totalPaise: pay.totalPaise,
        paymentsCount: pay.count,
        walkersCount: walkerGateCountMap.get(g.id) || 0,
      };
    });

    const totalSplitPaise = totalCashPaise + totalUpiPaise;
    const paymentModeSplit = {
      cashPaise: totalCashPaise,
      cashCount: totalCashCount,
      cashPct: totalSplitPaise > 0 ? Math.round((totalCashPaise / totalSplitPaise) * 100) : 50,
      upiPaise: totalUpiPaise,
      upiCount: totalUpiCount,
      upiPct: totalSplitPaise > 0 ? Math.round((totalUpiPaise / totalSplitPaise) * 100) : 50,
    };

    return {
      kpis,
      collectionsTrend,
      gateComparison,
      paymentModeSplit,
      registrationsOverTime,
    };
  }

  // =========================================================================
  // 2. Staff & User Management (Collectors & Admins)
  // =========================================================================
  async listUsers(query: ListUsersQueryInput) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          failedLogins: true,
          lockedUntil: true,
          lastLoginAt: true,
          totpSecret: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const sanitizedUsers = users.map((u) => ({
      ...u,
      has2FA: !!u.totpSecret,
      totpSecret: undefined,
    }));

    return { total, page, limit, data: sanitizedUsers };
  }

  async createUser(
    input: CreateUserInput,
    adminId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: input.email.toLowerCase() }, { phone: input.phone }],
      },
    });

    if (existing) {
      throw new ConflictException('A user with this email or phone number already exists');
    }

    const passwordHash = await CryptoUtil.hashPassword(input.password);

    const newUser = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone,
        role: input.role as Role,
        status: 'ACTIVE',
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'CREATE_USER',
      entity: 'User',
      entityId: newUser.id,
      after: {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
      ip,
      userAgent,
    });

    return newUser;
  }

  async updateUserStatus(
    userId: string,
    input: UpdateUserStatusInput,
    adminId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: input.status as UserStatus },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'UPDATE_USER_STATUS',
      entity: 'User',
      entityId: userId,
      before: { status: user.status },
      after: { status: updated.status, reason: input.reason },
      ip,
      userAgent,
    });

    return updated;
  }

  async resetUserPassword(
    userId: string,
    input: AdminResetPasswordInput,
    adminId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await CryptoUtil.hashPassword(input.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          failedLogins: 0,
          lockedUntil: null,
        },
      }),
      // Invalidate all existing refresh tokens for security
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      }),
    ]);

    await this.auditService.log({
      actorId: adminId,
      action: 'ADMIN_RESET_PASSWORD',
      entity: 'User',
      entityId: userId,
      ip,
      userAgent,
    });

    return { success: true, message: 'Password reset successfully and sessions invalidated.' };
  }

  async force2fa(
    userId: string,
    input: Force2faInput,
    adminId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: input.require2fa ? user.totpSecret : null,
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: input.require2fa ? 'FORCE_2FA_ENABLE' : 'RESET_2FA',
      entity: 'User',
      entityId: userId,
      after: { require2fa: input.require2fa },
      ip,
      userAgent,
    });

    return {
      success: true,
      message: input.require2fa
        ? '2FA enforcement noted for user.'
        : '2FA credentials reset. User will configure 2FA on next login.',
    };
  }

  // =========================================================================
  // 3. Gates Management
  // =========================================================================
  async listGates() {
    const gates = await this.prisma.gate.findMany({
      include: {
        _count: {
          select: { walkers: true, payments: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return gates.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      isActive: g.isActive,
      walkersCount: g._count.walkers,
      paymentsCount: g._count.payments,
      createdAt: g.createdAt,
    }));
  }

  async createGate(
    input: CreateGateInput,
    adminId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.gate.findUnique({
      where: { code: input.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Gate with code ${input.code} already exists`);
    }

    const gate = await this.prisma.gate.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        isActive: input.isActive ?? true,
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'CREATE_GATE',
      entity: 'Gate',
      entityId: gate.id,
      after: gate,
      ip,
      userAgent,
    });

    return gate;
  }

  async updateGate(
    gateId: string,
    input: UpdateGateInput,
    adminId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const gate = await this.prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate) throw new NotFoundException('Gate not found');

    const updated = await this.prisma.gate.update({
      where: { id: gateId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'UPDATE_GATE',
      entity: 'Gate',
      entityId: gateId,
      before: gate,
      after: updated,
      ip,
      userAgent,
    });

    return updated;
  }

  // =========================================================================
  // 4. System Settings (Pass Price, Validity, Threshold)
  // =========================================================================
  async getSettings() {
    const settings = await this.prisma.setting.findMany();
    const map = new Map(settings.map((s) => [s.key, s.value]));

    return {
      passPricePaise: map.has('PASS_PRICE_PAISE')
        ? parseInt(map.get('PASS_PRICE_PAISE')!, 10)
        : PASS_CONFIG.PRICE_PAISE,
      validityDays: map.has('PASS_VALIDITY_DAYS')
        ? parseInt(map.get('PASS_VALIDITY_DAYS')!, 10)
        : PASS_CONFIG.DURATION_DAYS,
      expiringThresholdDays: map.has('EXPIRING_THRESHOLD_DAYS')
        ? parseInt(map.get('EXPIRING_THRESHOLD_DAYS')!, 10)
        : PASS_CONFIG.EXPIRING_THRESHOLD_DAYS,
      timezone: PASS_CONFIG.TIMEZONE,
    };
  }

  async updateSettings(
    input: UpdateSettingsInput,
    adminId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const currentSettings = await this.getSettings();

    const updates: Array<Promise<unknown>> = [];
    if (input.passPricePaise !== undefined) {
      updates.push(
        this.prisma.setting.upsert({
          where: { key: 'PASS_PRICE_PAISE' },
          update: { value: String(input.passPricePaise) },
          create: { key: 'PASS_PRICE_PAISE', value: String(input.passPricePaise) },
        }),
      );
    }
    if (input.validityDays !== undefined) {
      updates.push(
        this.prisma.setting.upsert({
          where: { key: 'PASS_VALIDITY_DAYS' },
          update: { value: String(input.validityDays) },
          create: { key: 'PASS_VALIDITY_DAYS', value: String(input.validityDays) },
        }),
      );
    }
    if (input.expiringThresholdDays !== undefined) {
      updates.push(
        this.prisma.setting.upsert({
          where: { key: 'EXPIRING_THRESHOLD_DAYS' },
          update: { value: String(input.expiringThresholdDays) },
          create: { key: 'EXPIRING_THRESHOLD_DAYS', value: String(input.expiringThresholdDays) },
        }),
      );
    }

    await Promise.all(updates);

    await this.auditService.log({
      actorId: adminId,
      action: 'UPDATE_SETTINGS',
      entity: 'Setting',
      entityId: 'SYSTEM',
      before: currentSettings,
      after: input,
      ip,
      userAgent,
    });

    return this.getSettings();
  }
}
