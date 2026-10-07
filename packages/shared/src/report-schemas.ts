import { z } from 'zod';
import { PAYMENT_MODES } from './constants.js';

// Query schema for Collections Report
export const collectionsReportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gateId: z.string().uuid().optional(),
  collectorId: z.string().optional(),
  period: z.enum(['daily', 'monthly']).default('daily'),
});
export type CollectionsReportQueryInput = z.infer<typeof collectionsReportQuerySchema>;

// Query schema for Expiries Report
export const expiriesReportQuerySchema = z.object({
  threshold: z.enum(['7', '15', '30']).optional(),
  status: z.enum(['ALL', 'ACTIVE', 'EXPIRING', 'EXPIRED']).default('EXPIRING'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ExpiriesReportQueryInput = z.infer<typeof expiriesReportQuerySchema>;

// Query schema for Cash Reconciliation
export const cashReconciliationQuerySchema = z.object({
  date: z.string().optional(), // YYYY-MM-DD or ISO
  collectorId: z.string().optional(),
});
export type CashReconciliationQueryInput = z.infer<typeof cashReconciliationQuerySchema>;

// Input schema for Recording Cash Handover
export const recordCashReconciliationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  collectorId: z.string().min(1, 'Collector ID is required'),
  gateId: z.string().uuid().optional(),
  handedOverPaise: z.coerce.number().int().min(0, 'Handed over paise cannot be negative'),
  notes: z.string().trim().max(500).optional(),
});
export type RecordCashReconciliationInput = z.infer<typeof recordCashReconciliationSchema>;

// Query schema for Physical Receipt Register
export const receiptRegisterQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gateId: z.string().uuid().optional(),
  collectorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ReceiptRegisterQueryInput = z.infer<typeof receiptRegisterQuerySchema>;

// Query schema for Exporting Reports (CSV and Excel)
export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'excel']).default('csv'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gateId: z.string().uuid().optional(),
  collectorId: z.string().optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  type: z.enum(['NEW', 'RENEWAL']).optional(),
  status: z.enum(['ACTIVE', 'EXPIRING', 'EXPIRED']).optional(),
});
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;

/**
 * Formula Injection Protection (CSV / Excel Injection / DDE):
 * Prefixes any cell beginning with '=', '+', '-', or '@' with a single quote (').
 */
export function sanitizeForFormulaInjection(cellValue: unknown): string {
  if (cellValue === null || cellValue === undefined) {
    return '';
  }
  const str = String(cellValue);
  const trimmed = str.trimStart();
  if (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@')
  ) {
    return `'${str}`;
  }
  return str;
}
