import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CollectionsReportQueryInput,
  ExpiriesReportQueryInput,
  CashReconciliationQueryInput,
  RecordCashReconciliationInput,
  ReceiptRegisterQueryInput,
  ExportQueryInput,
  sanitizeForFormulaInjection,
  formatPaiseToInr,
} from '@wpd/shared';
import { PaymentMode, PaymentType, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 1. Daily and monthly collections breakdown by gate, collector, mode, and type.
   * Reports must group by the gate stored on each payment, not the walker's current gate.
   */
  async getCollectionsReport(query: CollectionsReportQueryInput) {
    const where: Prisma.PaymentWhereInput = {};

    if (query.gateId) {
      where.gateId = query.gateId;
    }
    if (query.collectorId) {
      where.collectedById = query.collectorId;
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

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        gate: true,
        collectedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalPaise = 0;
    const byGateMap = new Map<
      string,
      {
        code: string;
        name: string;
        count: number;
        paise: number;
        cashPaise: number;
        upiPaise: number;
      }
    >();
    const byCollectorMap = new Map<
      string,
      {
        id: string;
        name: string;
        count: number;
        paise: number;
        cashPaise: number;
        upiPaise: number;
      }
    >();
    const byMode = {
      CASH: { count: 0, paise: 0 },
      UPI: { count: 0, paise: 0 },
    };
    const byType = {
      NEW: { count: 0, paise: 0 },
      RENEWAL: { count: 0, paise: 0 },
    };
    const timelineMap = new Map<
      string,
      { date: string; count: number; paise: number; cashPaise: number; upiPaise: number }
    >();

    for (const p of payments) {
      totalPaise += p.amountPaise;

      // Group by payment's gate
      const gateKey = p.gateId;
      const gateStat = byGateMap.get(gateKey) || {
        code: p.gate.code,
        name: p.gate.name,
        count: 0,
        paise: 0,
        cashPaise: 0,
        upiPaise: 0,
      };
      gateStat.count += 1;
      gateStat.paise += p.amountPaise;
      if (p.mode === PaymentMode.CASH) gateStat.cashPaise += p.amountPaise;
      else gateStat.upiPaise += p.amountPaise;
      byGateMap.set(gateKey, gateStat);

      // Group by collector
      const colKey = p.collectedById;
      const colStat = byCollectorMap.get(colKey) || {
        id: p.collectedBy.id,
        name: p.collectedBy.name,
        count: 0,
        paise: 0,
        cashPaise: 0,
        upiPaise: 0,
      };
      colStat.count += 1;
      colStat.paise += p.amountPaise;
      if (p.mode === PaymentMode.CASH) colStat.cashPaise += p.amountPaise;
      else colStat.upiPaise += p.amountPaise;
      byCollectorMap.set(colKey, colStat);

      // Group by Mode
      if (p.mode === PaymentMode.CASH) {
        byMode.CASH.count += 1;
        byMode.CASH.paise += p.amountPaise;
      } else {
        byMode.UPI.count += 1;
        byMode.UPI.paise += p.amountPaise;
      }

      // Group by Type
      if (p.type === PaymentType.NEW) {
        byType.NEW.count += 1;
        byType.NEW.paise += p.amountPaise;
      } else {
        byType.RENEWAL.count += 1;
        byType.RENEWAL.paise += p.amountPaise;
      }

      // Group by Date / Month timeline
      const d = p.createdAt;
      const timeKey =
        query.period === 'monthly'
          ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
          : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const timeStat = timelineMap.get(timeKey) || {
        date: timeKey,
        count: 0,
        paise: 0,
        cashPaise: 0,
        upiPaise: 0,
      };
      timeStat.count += 1;
      timeStat.paise += p.amountPaise;
      if (p.mode === PaymentMode.CASH) timeStat.cashPaise += p.amountPaise;
      else timeStat.upiPaise += p.amountPaise;
      timelineMap.set(timeKey, timeStat);
    }

    return {
      summary: {
        totalPayments: payments.length,
        totalPaise,
        totalInr: formatPaiseToInr(totalPaise),
      },
      byGate: Array.from(byGateMap.values()).map((g) => ({
        ...g,
        inr: formatPaiseToInr(g.paise),
        cashInr: formatPaiseToInr(g.cashPaise),
        upiInr: formatPaiseToInr(g.upiPaise),
      })),
      byCollector: Array.from(byCollectorMap.values()).map((c) => ({
        ...c,
        inr: formatPaiseToInr(c.paise),
        cashInr: formatPaiseToInr(c.cashPaise),
        upiInr: formatPaiseToInr(c.upiPaise),
      })),
      byMode: {
        CASH: { ...byMode.CASH, inr: formatPaiseToInr(byMode.CASH.paise) },
        UPI: { ...byMode.UPI, inr: formatPaiseToInr(byMode.UPI.paise) },
      },
      byType: {
        NEW: { ...byType.NEW, inr: formatPaiseToInr(byType.NEW.paise) },
        RENEWAL: { ...byType.RENEWAL, inr: formatPaiseToInr(byType.RENEWAL.paise) },
      },
      timeline: Array.from(timelineMap.values()).map((t) => ({
        ...t,
        inr: formatPaiseToInr(t.paise),
      })),
    };
  }

  /**
   * 2. Expiries report: expiring in 7, 15, 30 days and expired list.
   * Never leaks Aadhaar.
   */
  async getExpiriesReport(query: ExpiriesReportQueryInput) {
    const now = new Date();
    const where: Prisma.WalkerWhereInput = { deletedAt: null };

    let targetMaxDate: Date | undefined;
    let isExpiredOnly = false;

    if (query.status === 'EXPIRED') {
      isExpiredOnly = true;
    } else if (query.threshold) {
      const days = parseInt(query.threshold, 10);
      targetMaxDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }

    const walkers = await this.prisma.walker.findMany({
      where,
      select: {
        id: true,
        name: true,
        passNo: true,
        phone: true,
        passes: {
          orderBy: { expiryDate: 'desc' },
          take: 1,
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            gate: { select: { code: true, name: true } },
            receiptNo: true,
            createdAt: true,
          },
        },
      },
    });

    const results = [];
    for (const w of walkers) {
      const latestPass = w.passes[0];
      if (!latestPass) continue;

      const expiry = latestPass.expiryDate;
      const msLeft = expiry.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      if (isExpiredOnly && daysLeft >= 0) continue;
      if (!isExpiredOnly && targetMaxDate) {
        if (daysLeft < 0 || expiry > targetMaxDate) continue;
      }

      results.push({
        id: w.id,
        name: w.name,
        passNo: w.passNo,
        phone: w.phone,
        startDate: latestPass.startDate,
        expiryDate: latestPass.expiryDate,
        daysRemaining: daysLeft,
        status: daysLeft < 0 ? 'EXPIRED' : daysLeft <= 7 ? 'EXPIRING' : 'ACTIVE',
        lastPaymentGate: w.payments[0]?.gate.code ?? 'N/A',
        lastReceiptNo: w.payments[0]?.receiptNo ?? 'N/A',
      });
    }

    // Sort by soonest expiry
    results.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

    const page = query.page || 1;
    const limit = query.limit || 50;
    const paginated = results.slice((page - 1) * limit, page * limit);

    return {
      total: results.length,
      page,
      limit,
      data: paginated,
    };
  }

  /**
   * 3. Cash reconciliation view per collector per day:
   * Expected cash from recorded payments vs cash handed over, with shortage/excess note.
   */
  async getCashReconciliation(query: CashReconciliationQueryInput) {
    const targetDateStr = query.date
      ? query.date.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

    const collectors = await this.prisma.user.findMany({
      where: query.collectorId ? { id: query.collectorId } : { role: 'COLLECTOR' },
      select: { id: true, name: true, email: true },
    });

    const rows = [];
    for (const c of collectors) {
      // Find all CASH payments recorded by this collector on this date
      const cashPayments = await this.prisma.payment.findMany({
        where: {
          collectedById: c.id,
          mode: PaymentMode.CASH,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        select: { amountPaise: true, gate: { select: { code: true } } },
      });

      const cashCount = cashPayments.length;
      const expectedCashPaise = cashPayments.reduce((sum, p) => sum + p.amountPaise, 0);

      // Find saved reconciliation entry if exists
      const savedRec = await this.prisma.cashReconciliation.findUnique({
        where: {
          date_collectorId: {
            date: startOfDay,
            collectorId: c.id,
          },
        },
        include: {
          reconciledBy: { select: { name: true, email: true } },
          gate: { select: { code: true, name: true } },
        },
      });

      const handedOverPaise = savedRec ? savedRec.handedOverPaise : expectedCashPaise;
      const differencePaise = savedRec ? savedRec.differencePaise : 0;
      const notes = savedRec ? savedRec.notes : null;

      rows.push({
        date: targetDateStr,
        collector: { id: c.id, name: c.name, email: c.email },
        cashPaymentsCount: cashCount,
        expectedCashPaise,
        expectedCashInr: formatPaiseToInr(expectedCashPaise),
        handedOverPaise,
        handedOverInr: formatPaiseToInr(handedOverPaise),
        differencePaise,
        differenceInr: formatPaiseToInr(differencePaise),
        status: differencePaise === 0 ? 'BALANCED' : differencePaise < 0 ? 'SHORTAGE' : 'EXCESS',
        notes,
        isReconciled: Boolean(savedRec),
        reconciledBy: savedRec?.reconciledBy?.name ?? null,
        reconciledAt: savedRec?.updatedAt ?? null,
      });
    }

    return {
      date: targetDateStr,
      reconciliations: rows,
    };
  }

  /**
   * Record or update cash reconciliation entry (Admin only).
   */
  async recordCashReconciliation(input: RecordCashReconciliationInput, adminId: string) {
    const shiftDate = new Date(`${input.date}T00:00:00.000Z`);
    const startOfDay = shiftDate;
    const endOfDay = new Date(`${input.date}T23:59:59.999Z`);

    // Calculate expected cash from database payments
    const cashPayments = await this.prisma.payment.findMany({
      where: {
        collectedById: input.collectorId,
        mode: PaymentMode.CASH,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      select: { amountPaise: true },
    });

    const expectedCashPaise = cashPayments.reduce((sum, p) => sum + p.amountPaise, 0);
    const differencePaise = input.handedOverPaise - expectedCashPaise;

    const result = await this.prisma.cashReconciliation.upsert({
      where: {
        date_collectorId: {
          date: shiftDate,
          collectorId: input.collectorId,
        },
      },
      create: {
        date: shiftDate,
        collectorId: input.collectorId,
        gateId: input.gateId,
        expectedCashPaise,
        handedOverPaise: input.handedOverPaise,
        differencePaise,
        notes: input.notes,
        reconciledById: adminId,
      },
      update: {
        expectedCashPaise,
        handedOverPaise: input.handedOverPaise,
        differencePaise,
        notes: input.notes,
        reconciledById: adminId,
      },
      include: {
        collector: { select: { id: true, name: true } },
        reconciledBy: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'CASH_RECONCILED',
      entity: 'CashReconciliation',
      entityId: result.id,
      after: {
        date: input.date,
        collectorId: input.collectorId,
        expectedCashPaise,
        handedOverPaise: input.handedOverPaise,
        differencePaise,
        notes: input.notes,
      },
    });

    return result;
  }

  /**
   * 4. Physical receipt register to spot gaps and verify all recorded slips.
   */
  async getReceiptRegister(query: ReceiptRegisterQueryInput) {
    const where: Prisma.PaymentWhereInput = {};
    if (query.gateId) where.gateId = query.gateId;
    if (query.collectorId) where.collectedById = query.collectorId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        walker: { select: { id: true, name: true, passNo: true } },
        gate: { select: { code: true, name: true } },
        collectedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Detect numeric sequence gaps in receipt numbers
    const gaps: Array<{
      prefix: string;
      missingFrom: number;
      missingTo: number;
      missingCount: number;
    }> = [];
    const prefixMap = new Map<string, number[]>();

    for (const p of payments) {
      const match = p.receiptNo.match(/^([A-Za-z0-9]+-)(\d+)$/);
      if (match && match[1] && match[2]) {
        const prefix = match[1];
        const num = parseInt(match[2], 10);
        const list = prefixMap.get(prefix) || [];
        list.push(num);
        prefixMap.set(prefix, list);
      }
    }

    for (const [prefix, numbers] of prefixMap.entries()) {
      numbers.sort((a, b) => a - b);
      for (let i = 0; i < numbers.length - 1; i++) {
        const curr = numbers[i]!;
        const next = numbers[i + 1]!;
        if (next > curr + 1) {
          gaps.push({
            prefix,
            missingFrom: curr + 1,
            missingTo: next - 1,
            missingCount: next - curr - 1,
          });
        }
      }
    }

    const records = payments.map((p) => ({
      paymentId: p.id,
      receiptNo: p.receiptNo,
      walkerName: p.walker.name,
      passNo: p.walker.passNo,
      gateCode: p.gate.code,
      gateName: p.gate.name,
      collectorName: p.collectedBy.name,
      amountPaise: p.amountPaise,
      amountInr: formatPaiseToInr(p.amountPaise),
      mode: p.mode,
      type: p.type,
      isCorrected: p.isCorrected,
      createdAt: p.createdAt,
    }));

    return {
      total: records.length,
      detectedGapsCount: gaps.length,
      detectedGaps: gaps,
      records,
    };
  }

  /**
   * 5. Payments Export (CSV / Excel) with formula-injection protection and UTF-8 BOM.
   * Reports group by the gate stored on each payment, not the walker's current gate.
   * Audited with filters used.
   */
  async exportPayments(query: ExportQueryInput, adminId: string, ip?: string, userAgent?: string) {
    const where: Prisma.PaymentWhereInput = {};
    if (query.gateId) where.gateId = query.gateId;
    if (query.collectorId) where.collectedById = query.collectorId;
    if (query.mode) where.mode = query.mode;
    if (query.type) where.type = query.type;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        walker: { select: { name: true, passNo: true, phone: true } },
        gate: { select: { code: true, name: true } },
        collectedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Write audit log with exact filters applied
    await this.auditService.log({
      actorId: adminId,
      action: 'EXPORT_GENERATED',
      entity: 'Payment',
      entityId: 'ALL_PAYMENTS',
      after: {
        exportType: 'PAYMENTS',
        format: query.format,
        filters: query,
        recordCount: payments.length,
      },
      ip,
      userAgent,
    });

    const rows = payments.map((p) => [
      sanitizeForFormulaInjection(p.receiptNo),
      sanitizeForFormulaInjection(p.walker.passNo),
      sanitizeForFormulaInjection(p.walker.name),
      sanitizeForFormulaInjection(p.walker.phone),
      sanitizeForFormulaInjection(`Gate ${p.gate.code} (${p.gate.name})`),
      sanitizeForFormulaInjection(p.mode),
      sanitizeForFormulaInjection(p.type),
      sanitizeForFormulaInjection((p.amountPaise / 100).toFixed(2)),
      sanitizeForFormulaInjection(p.collectedBy.name),
      sanitizeForFormulaInjection(p.createdAt.toISOString()),
      sanitizeForFormulaInjection(p.isCorrected ? 'YES' : 'NO'),
    ]);

    const headers = [
      'Receipt No',
      'Pass No',
      'Walker Name',
      'Phone',
      'Payment Entry Gate',
      'Mode',
      'Type',
      'Amount (INR)',
      'Collected By',
      'Created At (UTC)',
      'Corrected',
    ];

    if (query.format === 'excel') {
      return this.generateExcelBuffer('Payment Collections', headers, rows);
    }

    return this.generateCsvString(headers, rows);
  }

  /**
   * Helper: Generate CSV string with UTF-8 BOM and RFC 4180 escaping
   */
  private generateCsvString(headers: string[], rows: string[][]): string {
    const escapeCsv = (val: string) => {
      if (val.includes('"') || val.includes(',') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headerLine = headers.map(escapeCsv).join(',');
    const rowLines = rows.map((r) => r.map(escapeCsv).join(','));
    // UTF-8 BOM \uFEFF for seamless Excel opening
    return `\uFEFF${headerLine}\n${rowLines.join('\n')}\n`;
  }

  /**
   * Helper: Generate Excel workbook buffer using ExcelJS
   */
  private async generateExcelBuffer(
    sheetName: string,
    headers: string[],
    rows: string[][],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Walker Pass Desk';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetName);
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };

    for (const row of rows) {
      sheet.addRow(row);
    }

    sheet.columns.forEach((col) => {
      col.width = 22;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
