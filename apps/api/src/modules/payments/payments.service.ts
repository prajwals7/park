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

  /**
   * Generates receipt payload for small thermal printer.
   * Explicitly excludes Aadhaar numbers to maintain privacy rules.
   */
  async getPaymentReceipt(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        walker: {
          select: {
            id: true,
            name: true,
            passNo: true,
            phone: true,
          },
        },
        pass: true,
        gate: true,
        collectedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: `Payment ${paymentId} not found`,
      });
    }

    const issuedAtIst = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(payment.createdAt);

    const validFromIst = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
    }).format(payment.pass.startDate);

    const validUntilIst = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
    }).format(payment.pass.expiryDate);

    return {
      parkName: 'WALKER PASS DESK - LARGE WALKING PARK',
      walkerName: payment.walker.name,
      passNo: payment.walker.passNo,
      receiptNo: payment.receiptNo,
      gate: `Gate ${payment.gate.code} (${payment.gate.name})`,
      amountPaise: payment.amountPaise,
      amountInr: `₹${(payment.amountPaise / 100).toFixed(2)}`,
      mode: payment.mode,
      type: payment.type,
      validFrom: validFromIst,
      validUntil: validUntilIst,
      validityDays: 30,
      collectorName: payment.collectedBy.name,
      issuedAt: issuedAtIst,
    };
  }

  generateThermalReceiptHtml(receipt: {
    parkName: string;
    walkerName: string;
    passNo: string;
    receiptNo: string;
    gate: string;
    amountInr: string;
    mode: string;
    type: string;
    validFrom: string;
    validUntil: string;
    collectorName: string;
    issuedAt: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${receipt.receiptNo}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 76mm;
      margin: 0 auto;
      padding: 12px 8px;
      font-size: 13px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; }
    .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
    .subtitle { font-size: 11px; margin-bottom: 6px; }
    .footer { font-size: 10px; margin-top: 10px; text-align: center; }
    .btn-print {
      display: block;
      width: 100%;
      padding: 8px;
      background: #333;
      color: #fff;
      border: none;
      font-weight: bold;
      cursor: pointer;
      margin-bottom: 12px;
      border-radius: 4px;
    }
    @media print {
      .btn-print { display: none; }
      body { width: 100%; padding: 0; }
    }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">🖨️ PRINT RECEIPT</button>
  <div class="text-center">
    <div class="title">${receipt.parkName}</div>
    <div class="subtitle">PHYSICAL GATE TICKETING DESK</div>
  </div>
  <div class="divider"></div>
  <div class="row"><span class="bold">RECEIPT NO:</span><span class="bold">${receipt.receiptNo}</span></div>
  <div class="row"><span>DATE / TIME:</span><span>${receipt.issuedAt}</span></div>
  <div class="row"><span>GATE:</span><span>${receipt.gate}</span></div>
  <div class="row"><span>COLLECTOR:</span><span>${receipt.collectorName}</span></div>
  <div class="divider"></div>
  <div class="row"><span class="bold">WALKER NAME:</span><span class="bold">${receipt.walkerName}</span></div>
  <div class="row"><span class="bold">PASS NO:</span><span class="bold">${receipt.passNo}</span></div>
  <div class="row"><span>PASS TYPE:</span><span>${receipt.type} (30-DAY PASS)</span></div>
  <div class="row"><span>VALID FROM:</span><span>${receipt.validFrom}</span></div>
  <div class="row"><span class="bold">VALID UNTIL:</span><span class="bold">${receipt.validUntil}</span></div>
  <div class="divider"></div>
  <div class="row" style="font-size: 15px;">
    <span class="bold">AMOUNT PAID:</span>
    <span class="bold">${receipt.amountInr}</span>
  </div>
  <div class="row"><span>PAYMENT MODE:</span><span>${receipt.mode} (PHYSICAL)</span></div>
  <div class="divider"></div>
  <div class="footer">
    *** OFFICIAL PHYSICAL PASS RECEIPT ***<br>
    Please retain this receipt slip and carry your physical pass card inside the park.<br>
    Entry subject to physical pass verification.
  </div>
</body>
</html>`;
  }
}
