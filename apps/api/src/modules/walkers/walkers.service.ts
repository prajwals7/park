import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateWalkerInput,
  UpdateWalkerInput,
  SoftDeleteWalkerInput,
  RenewWalkerPassInput,
  ListWalkersQueryInput,
  calculateNewPassExpiry,
  calculateRenewalExpiry,
  calculatePassStatus,
  PASS_CONFIG,
  PaymentMode,
} from '@wpd/shared';
import { Role, Prisma, PassStatus } from '@prisma/client';

// In-memory idempotency cache for transactions: key -> result payload
const idempotencyStore = new Map<string, { result: unknown; expiresAt: number }>();

@Injectable()
export class WalkersService {
  private readonly logger = new Logger(WalkersService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // 1. List walkers with search, status filtering, and pagination
  async listWalkers(query: ListWalkersQueryInput) {
    const { page, limit, search, status, gateId, expiryStart, expiryEnd, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WalkerWhereInput = {
      deletedAt: null, // Default non-deleted
    };

    if (gateId) {
      where.gateId = gateId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { passNo: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status || expiryStart || expiryEnd) {
      where.passes = {
        some: {
          ...(status ? { status: status as PassStatus } : {}),
          ...(expiryStart || expiryEnd
            ? {
                expiryDate: {
                  ...(expiryStart ? { gte: new Date(expiryStart) } : {}),
                  ...(expiryEnd ? { lte: new Date(expiryEnd) } : {}),
                },
              }
            : {}),
        },
      };
    }

    const [total, walkers] = await Promise.all([
      this.prisma.walker.count({ where }),
      this.prisma.walker.findMany({
        where,
        skip,
        take: limit,
        include: {
          gate: true,
          passes: {
            orderBy: { expiryDate: 'desc' },
            take: 1, // Latest pass
          },
        },
        orderBy: {
          passes: {
            _count: sortOrder,
          },
        },
      }),
    ]);

    // Format results with computed real-time status
    const data = walkers.map((w) => {
      const latestPass = w.passes[0];
      const realStatus = latestPass
        ? calculatePassStatus(latestPass.expiryDate)
        : PassStatus.EXPIRED;

      return {
        id: w.id,
        passNo: w.passNo,
        name: w.name,
        phone: w.phone,
        gate: w.gate.name,
        gateCode: w.gate.code,
        aadhaarLast4: w.aadhaarLast4,
        notes: w.notes,
        createdAt: w.createdAt,
        latestPass: latestPass
          ? {
              id: latestPass.id,
              startDate: latestPass.startDate,
              expiryDate: latestPass.expiryDate,
              status: realStatus,
            }
          : null,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 2. Register Walker + First Payment in one atomic transaction with Idempotency
  async createWalker(
    input: CreateWalkerInput,
    userId: string,
    userRole: Role,
    idempotencyKey?: string,
    ip?: string,
    userAgent?: string,
  ) {
    if (idempotencyKey) {
      const cached = idempotencyStore.get(idempotencyKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.logger.log(`Returning cached response for idempotency key ${idempotencyKey}`);
        return cached.result;
      }
    }

    // A. Check duplicate passNo
    const existingPassNo = await this.prisma.walker.findUnique({
      where: { passNo: input.passNo },
    });
    if (existingPassNo) {
      throw new ConflictException({
        code: 'DUPLICATE_PASS_NO',
        message: `Pass number ${input.passNo} is already registered to walker: ${existingPassNo.name}`,
      });
    }

    // B. Check duplicate phone
    const existingPhone = await this.prisma.walker.findFirst({
      where: { phone: input.phone, deletedAt: null },
    });
    if (existingPhone) {
      if (!input.allowDuplicatePhoneOverride) {
        throw new ConflictException({
          code: 'DUPLICATE_PHONE_WARNING',
          message: `Phone number ${input.phone} already belongs to walker ${existingPhone.name} (${existingPhone.passNo}). Override required.`,
        });
      }
      // Only Admins can override duplicate phones
      if (userRole !== Role.ADMIN && userRole !== Role.SUPER_ADMIN) {
        throw new ForbiddenException({
          code: 'OVERRIDE_FORBIDDEN',
          message: 'Only Administrators can authorize duplicate phone overrides.',
        });
      }
    }

    // C. Execute atomic transaction
    const now = new Date();
    const expiryDate = calculateNewPassExpiry(now);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Walker
      const walker = await tx.walker.create({
        data: {
          passNo: input.passNo,
          name: input.name,
          phone: input.phone,
          gateId: input.gateId,
          aadhaarLast4: input.aadhaarLast4,
          notes: input.notes,
          consentAt: now,
          createdById: userId,
        },
      });

      // 2. Create Pass (30 days validity)
      const pass = await tx.pass.create({
        data: {
          walkerId: walker.id,
          startDate: now,
          expiryDate,
          status: PassStatus.ACTIVE,
        },
      });

      // 3. Attach Documents
      await tx.document.createMany({
        data: [
          {
            walkerId: walker.id,
            type: 'AADHAAR',
            storageKey: input.aadhaarStorageKey,
            mimeType: 'image/jpeg',
            sizeBytes: 1024 * 300,
            uploadedById: userId,
          },
          {
            walkerId: walker.id,
            type: 'PASSPORT',
            storageKey: input.passportStorageKey,
            mimeType: 'image/jpeg',
            sizeBytes: 1024 * 150,
            uploadedById: userId,
          },
        ],
      });

      // 4. Generate annual sequential receipt number
      const currentYear = now.getUTCFullYear();
      const countThisYear = await tx.payment.count({
        where: {
          createdAt: {
            gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          },
        },
      });
      const receiptNo = `RCP-${currentYear}-${String(countThisYear + 1).padStart(6, '0')}`;

      // 5. Create Payment record (Integer paise: 20000 = Rs 200)
      const payment = await tx.payment.create({
        data: {
          walkerId: walker.id,
          passId: pass.id,
          gateId: input.gateId,
          collectedById: userId,
          amountPaise: PASS_CONFIG.PRICE_PAISE,
          mode: input.paymentMode as PaymentMode,
          type: 'NEW',
          receiptNo,
        },
      });

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'REGISTER_WALKER',
          entity: 'Walker',
          entityId: walker.id,
          after: {
            passNo: walker.passNo,
            name: walker.name,
            phone: walker.phone,
            receiptNo: payment.receiptNo,
            amountPaise: payment.amountPaise,
            duplicatePhoneOverridden: Boolean(input.allowDuplicatePhoneOverride),
            overrideReason: input.overrideReason,
          },
          ip,
          userAgent,
        },
      });

      return {
        walker: {
          id: walker.id,
          passNo: walker.passNo,
          name: walker.name,
          phone: walker.phone,
          expiryDate: pass.expiryDate,
        },
        payment: {
          id: payment.id,
          receiptNo: payment.receiptNo,
          amountPaise: payment.amountPaise,
          mode: payment.mode,
          createdAt: payment.createdAt,
        },
      };
    });

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        result,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h retention
      });
    }

    return result;
  }

  // 3. Get walker profile by ID with full pass history & payments
  async getWalker(id: string) {
    const walker = await this.prisma.walker.findUnique({
      where: { id },
      include: {
        gate: true,
        createdBy: { select: { id: true, name: true, email: true } },
        deletedBy: { select: { id: true, name: true, email: true } },
        passes: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            gate: true,
            collectedBy: { select: { id: true, name: true } },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!walker || walker.deletedAt !== null) {
      throw new NotFoundException({
        code: 'WALKER_NOT_FOUND',
        message: 'Walker record not found or has been deleted',
      });
    }

    const currentPass = walker.passes[0];
    const realStatus = currentPass
      ? calculatePassStatus(currentPass.expiryDate)
      : PassStatus.EXPIRED;

    return {
      ...walker,
      currentStatus: realStatus,
    };
  }

  // 4. Update walker details (Admin only, audits before & after)
  async updateWalker(
    id: string,
    input: UpdateWalkerInput,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const walker = await this.prisma.walker.findUnique({ where: { id } });
    if (!walker || walker.deletedAt !== null) {
      throw new NotFoundException({
        code: 'WALKER_NOT_FOUND',
        message: 'Walker not found',
      });
    }

    const updated = await this.prisma.walker.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.gateId ? { gateId: input.gateId } : {}),
        ...(input.aadhaarLast4 !== undefined ? { aadhaarLast4: input.aadhaarLast4 } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    await this.auditService.log({
      actorId,
      action: 'UPDATE_WALKER',
      entity: 'Walker',
      entityId: id,
      before: {
        name: walker.name,
        phone: walker.phone,
        notes: walker.notes,
        gateId: walker.gateId,
      },
      after: {
        name: updated.name,
        phone: updated.phone,
        notes: updated.notes,
        gateId: updated.gateId,
      },
      ip,
      userAgent,
    });

    return updated;
  }

  // 5. Soft Delete Walker (Admin only)
  async softDeleteWalker(
    id: string,
    input: SoftDeleteWalkerInput,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const walker = await this.prisma.walker.findUnique({ where: { id } });
    if (!walker || walker.deletedAt !== null) {
      throw new NotFoundException({
        code: 'WALKER_NOT_FOUND',
        message: 'Walker not found or already deleted',
      });
    }

    const now = new Date();
    await this.prisma.walker.update({
      where: { id },
      data: {
        deletedAt: now,
        deletedById: actorId,
        notes: walker.notes
          ? `${walker.notes}\n[Deleted]: ${input.reason}`
          : `[Deleted]: ${input.reason}`,
      },
    });

    await this.auditService.log({
      actorId,
      action: 'SOFT_DELETE_WALKER',
      entity: 'Walker',
      entityId: id,
      before: { deletedAt: null },
      after: { deletedAt: now, reason: input.reason },
      ip,
      userAgent,
    });

    return { success: true, message: 'Walker record soft-deleted successfully' };
  }

  // 6. Restore Walker (Admin only)
  async restoreWalker(id: string, actorId: string, ip?: string, userAgent?: string) {
    const walker = await this.prisma.walker.findUnique({ where: { id } });
    if (!walker) {
      throw new NotFoundException({
        code: 'WALKER_NOT_FOUND',
        message: 'Walker record not found',
      });
    }
    if (walker.deletedAt === null) {
      throw new BadRequestException({
        code: 'WALKER_NOT_DELETED',
        message: 'Walker record is not deleted',
      });
    }

    await this.prisma.walker.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null,
      },
    });

    await this.auditService.log({
      actorId,
      action: 'RESTORE_WALKER',
      entity: 'Walker',
      entityId: id,
      before: { deletedAt: walker.deletedAt },
      after: { deletedAt: null },
      ip,
      userAgent,
    });

    return { success: true, message: 'Walker record restored successfully' };
  }

  // 7. Renew Walker Pass (Atomic Transaction + Concurrency Locking + Idempotency)
  async renewWalkerPass(
    walkerId: string,
    input: RenewWalkerPassInput,
    userId: string,
    idempotencyKey?: string,
    ip?: string,
    userAgent?: string,
  ) {
    if (idempotencyKey) {
      const cached = idempotencyStore.get(idempotencyKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.logger.log(`Returning cached response for renewal idempotency key ${idempotencyKey}`);
        return cached.result;
      }
    }

    const now = new Date();

    const result = await this.prisma.$transaction(
      async (tx) => {
        // Concurrency lock: Select walker row FOR UPDATE to prevent race conditions
        const lockedWalkers = await tx.$queryRaw<
          Array<{ id: string; name: string; deletedAt: Date | null }>
        >`
          SELECT id, name, "deletedAt" FROM walkers WHERE id = ${walkerId} FOR UPDATE
        `;

        const lockedWalker = lockedWalkers[0];
        if (!lockedWalker || lockedWalker.deletedAt !== null) {
          throw new NotFoundException({
            code: 'WALKER_NOT_FOUND',
            message: 'Walker not found or has been soft-deleted',
          });
        }

        // Fetch latest pass
        const currentPass = await tx.pass.findFirst({
          where: { walkerId },
          orderBy: { expiryDate: 'desc' },
        });

        if (!currentPass) {
          throw new BadRequestException({
            code: 'NO_PREVIOUS_PASS',
            message: 'Walker has no previous pass to renew',
          });
        }

        // Business rule: renewal extends from max(today, current expiry) by 30 days
        const newExpiryDate = calculateRenewalExpiry(currentPass.expiryDate, now);

        // 1. Create Renewal Pass Record
        const newPass = await tx.pass.create({
          data: {
            walkerId,
            startDate: now,
            expiryDate: newExpiryDate,
            status: PassStatus.ACTIVE,
          },
        });

        // 2. Attach Renewal Ticket Document
        const ticketDoc = await tx.document.create({
          data: {
            walkerId,
            type: 'TICKET',
            storageKey: input.ticketStorageKey,
            mimeType: 'image/jpeg',
            sizeBytes: 1024 * 200,
            uploadedById: userId,
          },
        });

        // 3. Generate sequential receipt number
        const currentYear = now.getUTCFullYear();
        const countThisYear = await tx.payment.count({
          where: {
            createdAt: {
              gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
            },
          },
        });
        const receiptNo = `RCP-${currentYear}-${String(countThisYear + 1).padStart(6, '0')}`;

        // 4. Create Immutable Payment Record
        const payment = await tx.payment.create({
          data: {
            walkerId,
            passId: newPass.id,
            gateId: input.gateId,
            collectedById: userId,
            amountPaise: PASS_CONFIG.PRICE_PAISE,
            mode: input.paymentMode as PaymentMode,
            type: 'RENEWAL',
            receiptNo,
            ticketDocId: ticketDoc.id,
          },
        });

        await tx.document.update({
          where: { id: ticketDoc.id },
          data: { paymentId: payment.id },
        });

        // 5. Write Audit Log
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'RENEW_PASS',
            entity: 'Walker',
            entityId: walkerId,
            before: { previousExpiryDate: currentPass.expiryDate },
            after: {
              newExpiryDate,
              receiptNo: payment.receiptNo,
              amountPaise: payment.amountPaise,
              gateId: input.gateId,
            },
            ip,
            userAgent,
          },
        });

        return {
          walker: {
            id: walkerId,
            name: lockedWalker.name,
            previousExpiryDate: currentPass.expiryDate,
            newExpiryDate,
            status: PassStatus.ACTIVE,
          },
          payment: {
            id: payment.id,
            receiptNo: payment.receiptNo,
            amountPaise: payment.amountPaise,
            mode: payment.mode,
            createdAt: payment.createdAt,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        result,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
    }

    return result;
  }
}
