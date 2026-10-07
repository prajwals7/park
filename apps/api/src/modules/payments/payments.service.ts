import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CorrectPaymentInput } from '@wpd/shared';
import { PaymentMode } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin-only correction of physical receipt number or payment mode.
   * Keeps the original row, enforces DB-level immutability trigger via local session setting,
   * checks receipt number uniqueness, and writes a detailed before/after audit log.
   */
  async correctPayment(
    paymentId: string,
    input: CorrectPaymentInput,
    adminId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const existing = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: `Payment record with ID ${paymentId} not found`,
      });
    }

    let targetReceiptNo: string | undefined = undefined;
    if (input.receiptNo) {
      targetReceiptNo = input.receiptNo.trim().toUpperCase();
      if (targetReceiptNo !== existing.receiptNo) {
        const duplicate = await this.prisma.payment.findUnique({
          where: { receiptNo: targetReceiptNo },
        });
        if (duplicate) {
          throw new ConflictException({
            code: 'DUPLICATE_RECEIPT_NO',
            message: `Physical receipt number ${targetReceiptNo} has already been recorded for payment ${duplicate.id}`,
          });
        }
      }
    }

    const now = new Date();
    const reason = input.reason.trim();

    return this.prisma.$transaction(async (tx) => {
      // 1. Authorize trigger bypass exclusively for this correction transaction
      await tx.$executeRawUnsafe(`SET LOCAL app.allow_payment_correction = 'on'`);

      // 2. Update the original row with corrected values and audit metadata
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          receiptNo: targetReceiptNo ?? undefined,
          mode: input.mode ? (input.mode as PaymentMode) : undefined,
          isCorrected: true,
          correctionReason: reason,
          correctedAt: now,
          correctedById: adminId,
        },
        include: {
          walker: { select: { id: true, name: true, passNo: true } },
          pass: { select: { id: true, startDate: true, expiryDate: true, status: true } },
          collectedBy: { select: { id: true, name: true, email: true, role: true } },
          correctedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      // 3. Write immutable audit log record with before & after state
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'CORRECT_PAYMENT',
          entity: 'Payment',
          entityId: paymentId,
          before: {
            receiptNo: existing.receiptNo,
            mode: existing.mode,
            isCorrected: existing.isCorrected,
          },
          after: {
            receiptNo: updated.receiptNo,
            mode: updated.mode,
            reason,
            isCorrected: true,
            correctedAt: now,
          },
          ip,
          userAgent,
        },
      });

      return updated;
    });
  }
}
