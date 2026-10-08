import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';
import {
  collectionsReportQuerySchema,
  CollectionsReportQueryInput,
  expiriesReportQuerySchema,
  ExpiriesReportQueryInput,
  cashReconciliationQuerySchema,
  CashReconciliationQueryInput,
  recordCashReconciliationSchema,
  RecordCashReconciliationInput,
  receiptRegisterQuerySchema,
  ReceiptRegisterQueryInput,
  exportQuerySchema,
  ExportQueryInput,
} from '@wpd/shared';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('collections')
  @ApiOperation({
    summary: 'Daily and monthly collections breakdown',
    description:
      'Provides payment totals and counts grouped by the gate where payment was collected, collector, payment mode (CASH vs UPI), and payment type (NEW vs RENEWAL). Restricted to Admins.',
  })
  @ApiResponse({ status: 200, description: 'Collections aggregated report retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden: Collector role cannot access reports' })
  async getCollectionsReport(
    @Query(new ZodValidationPipe(collectionsReportQuerySchema)) query: CollectionsReportQueryInput,
  ) {
    return this.reportsService.getCollectionsReport(query);
  }

  @Get('expiries')
  @ApiOperation({
    summary: 'Walker pass expiries report',
    description:
      'Provides list of passes expiring in 7, 15, or 30 days and expired passes. Aadhaar is strictly excluded. Restricted to Admins.',
  })
  @ApiResponse({ status: 200, description: 'Expiries report retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden: Collector role cannot access reports' })
  async getExpiriesReport(
    @Query(new ZodValidationPipe(expiriesReportQuerySchema)) query: ExpiriesReportQueryInput,
  ) {
    return this.reportsService.getExpiriesReport(query);
  }

  @Get('cash-reconciliation')
  @ApiOperation({
    summary: 'Cash reconciliation per collector per day',
    description:
      'Compares expected physical cash collected against cash handed over, calculating shortages or excesses. Restricted to Admins.',
  })
  @ApiResponse({ status: 200, description: 'Cash reconciliation data retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden: Collector role cannot access reports' })
  async getCashReconciliation(
    @Query(new ZodValidationPipe(cashReconciliationQuerySchema))
    query: CashReconciliationQueryInput,
  ) {
    return this.reportsService.getCashReconciliation(query);
  }

  @Post('cash-reconciliation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record cash handover reconciliation',
    description:
      'Records or updates end-of-shift physical cash handover per collector with difference calculation and audit log. Restricted to Admins.',
  })
  @ApiResponse({ status: 200, description: 'Cash reconciliation recorded successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Collector role cannot record reconciliation',
  })
  async recordCashReconciliation(
    @Body(new ZodValidationPipe(recordCashReconciliationSchema))
    body: RecordCashReconciliationInput,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.reportsService.recordCashReconciliation(body, user.id);
  }

  @Get('receipt-register')
  @ApiOperation({
    summary: 'Physical receipt slip register and sequence gap detector',
    description:
      'Lists physical receipts issued and flags any numeric sequence gaps in receipt slip booklets. Restricted to Admins.',
  })
  @ApiResponse({ status: 200, description: 'Physical receipt register and gaps retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden: Collector role cannot access reports' })
  async getReceiptRegister(
    @Query(new ZodValidationPipe(receiptRegisterQuerySchema)) query: ReceiptRegisterQueryInput,
  ) {
    return this.reportsService.getReceiptRegister(query);
  }

  @Get('export/payments')
  @ApiOperation({
    summary: 'Export payment collections to CSV or Excel',
    description:
      'Streams CSV (with UTF-8 BOM) or Excel XLSX with formula injection protection (prepends single quote to cells starting with =, +, -, @). Audits the export with query filters. Restricted to Admins.',
  })
  @ApiResponse({ status: 200, description: 'File generated and streamed' })
  @ApiResponse({ status: 403, description: 'Forbidden: Collector role cannot export data' })
  async exportPayments(
    @Query(new ZodValidationPipe(exportQuerySchema)) query: ExportQueryInput,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const dateStr = new Date().toISOString().slice(0, 10);

    const result = await this.reportsService.exportPayments(query, user.id, ip, userAgent);

    if (query.format === 'excel') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="payments-collections-${dateStr}.xlsx"`,
      );
      return res.send(result);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payments-collections-${dateStr}.csv"`,
    );
    return res.send(result);
  }
}
