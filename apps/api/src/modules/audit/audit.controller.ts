import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';
import { auditLogsQuerySchema, AuditLogsQueryInput } from '@wpd/shared';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Query audit logs with actor, action, entity, and date filters',
    description: 'Lists system audit logs with pagination and JSON diff details. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden: Collector role cannot access audit logs' })
  async getAuditLogs(
    @Query(new ZodValidationPipe(auditLogsQuerySchema)) query: AuditLogsQueryInput,
  ) {
    return this.auditService.getAuditLogs(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export audit logs to CSV',
    description: 'Streams UTF-8 BOM CSV with formula injection protection. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Audit log CSV generated' })
  async exportAuditLogs(
    @Query(new ZodValidationPipe(auditLogsQuerySchema)) query: AuditLogsQueryInput,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const dateStr = new Date().toISOString().slice(0, 10);

    const csvContent = await this.auditService.exportAuditLogs(query, user.id, ip, userAgent);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs-${dateStr}.csv"`,
    );
    return res.send(csvContent);
  }
}
