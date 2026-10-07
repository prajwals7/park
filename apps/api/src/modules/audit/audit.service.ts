import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsQueryInput, sanitizeForFormulaInjection } from '@wpd/shared';
import { Prisma } from '@prisma/client';

export interface AuditParams {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(params: AuditParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          before: (params.before as object) || undefined,
          after: (params.after as object) || undefined,
          ip: params.ip,
          userAgent: params.userAgent,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log for action: ${params.action}`, err);
    }
  }

  async getAuditLogs(query: AuditLogsQueryInput) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    if (query.entity) {
      where.entity = { contains: query.entity, mode: 'insensitive' };
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      data,
    };
  }

  async exportAuditLogs(
    query: AuditLogsQueryInput,
    adminId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<string> {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.entity) where.entity = { contains: query.entity, mode: 'insensitive' };
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Audit the export action
    await this.log({
      actorId: adminId,
      action: 'EXPORT_AUDIT_LOGS',
      entity: 'AuditLog',
      entityId: 'ALL',
      after: { filter: query, count: logs.length },
      ip,
      userAgent,
    });

    const headers = [
      'Timestamp',
      'Actor ID',
      'Actor Name',
      'Actor Role',
      'Action',
      'Entity',
      'Entity ID',
      'IP Address',
      'User Agent',
      'Before State',
      'After State',
    ];

    const escapeCsv = (val: unknown): string => {
      const sanitized = sanitizeForFormulaInjection(val);
      const str = String(sanitized).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.map(escapeCsv).join(',')];

    for (const log of logs) {
      const row = [
        log.createdAt.toISOString(),
        log.actorId,
        log.actor?.name || 'System',
        log.actor?.role || 'N/A',
        log.action,
        log.entity,
        log.entityId,
        log.ip || '',
        log.userAgent || '',
        log.before ? JSON.stringify(log.before) : '',
        log.after ? JSON.stringify(log.after) : '',
      ];
      csvRows.push(row.map(escapeCsv).join(','));
    }

    return '\uFEFF' + csvRows.join('\r\n');
  }
}
