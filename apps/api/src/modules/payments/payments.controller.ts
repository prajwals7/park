import {
  Controller,
  Patch,
  Get,
  Query,
  Res,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';
import { correctPaymentSchema, CorrectPaymentInput } from '@wpd/shared';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Patch(':id/correct')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin payment correction (Receipt No or Mode)',
    description:
      'Allows Administrators to correct mistyped physical receipt numbers or payment mode (CASH/UPI). Keeps original row and writes immutable audit log with before/after state. Collectors receive 403 Forbidden.',
  })
  @ApiResponse({ status: 200, description: 'Payment successfully corrected' })
  @ApiResponse({ status: 400, description: 'Invalid input or missing required correction reason' })
  @ApiResponse({ status: 403, description: 'Forbidden: Collector role cannot correct payments' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 409, description: 'Duplicate receipt number' })
  async correctPayment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(correctPaymentSchema)) body: CorrectPaymentInput,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.paymentsService.correctPayment(id, body, user.id, ip, userAgent);
  }

  @Get(':id/receipt')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COLLECTOR)
  @ApiOperation({
    summary: 'Print-friendly thermal receipt view',
    description:
      'Provides formatted physical receipt slip data (park name, walker name, pass no, receipt no, gate, amount, validity dates, collector) for small thermal printers. Never displays Aadhaar.',
  })
  @ApiResponse({ status: 200, description: 'Receipt data retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getReceipt(
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const receipt = await this.paymentsService.getPaymentReceipt(id);
    if (format === 'html') {
      const html = this.paymentsService.generateThermalReceiptHtml(receipt);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return html;
    }
    return receipt;
  }
}
