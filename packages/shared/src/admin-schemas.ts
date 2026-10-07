import { z } from 'zod';
import { GATES, PASS_STATUSES, ROLES, USER_STATUSES } from './constants.js';
import { phoneSchema, passwordPolicySchema } from './auth-schemas.js';

// ==========================================
// User Management Schemas
// ==========================================

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  phone: phoneSchema,
  role: z.enum(ROLES).default('COLLECTOR'),
  password: passwordPolicySchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
  reason: z.string().trim().min(3, 'Reason must be provided').max(255).optional(),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const adminResetPasswordSchema = z.object({
  newPassword: passwordPolicySchema,
});
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

export const force2faSchema = z.object({
  require2fa: z.boolean(),
});
export type Force2faInput = z.infer<typeof force2faSchema>;

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});
export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;

// ==========================================
// Gate & Settings Schemas
// ==========================================

export const createGateSchema = z.object({
  code: z.string().trim().min(2).max(10).toUpperCase(),
  name: z.string().trim().min(2).max(50),
  isActive: z.boolean().default(true),
});
export type CreateGateInput = z.infer<typeof createGateSchema>;

export const updateGateSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateGateInput = z.infer<typeof updateGateSchema>;

export const updateSettingsSchema = z.object({
  passPricePaise: z.coerce.number().int().min(100).max(1000000).optional(),
  validityDays: z.coerce.number().int().min(1).max(365).optional(),
  expiringThresholdDays: z.coerce.number().int().min(1).max(30).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ==========================================
// Audit Logs Query Schema
// ==========================================

export const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  actorId: z.string().optional(),
  action: z.string().trim().optional(),
  entity: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type AuditLogsQueryInput = z.infer<typeof auditLogsQuerySchema>;

// ==========================================
// Walkers Bulk Export Query Schema
// ==========================================

export const exportWalkersQuerySchema = z.object({
  format: z.enum(['csv', 'excel']).default('csv'),
  status: z.enum(PASS_STATUSES).optional(),
  gateId: z.string().optional(),
  search: z.string().trim().optional(),
  expiryStart: z.string().optional(),
  expiryEnd: z.string().optional(),
});
export type ExportWalkersQueryInput = z.infer<typeof exportWalkersQuerySchema>;

// ==========================================
// Dashboard Overview Query & Response Schemas
// ==========================================

export const dashboardOverviewQuerySchema = z.object({
  range: z.enum(['today', '7d', '30d', 'custom']).default('7d'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gateId: z.string().optional(),
});
export type DashboardOverviewQueryInput = z.infer<typeof dashboardOverviewQuerySchema>;

export interface DashboardKpis {
  activeWalkers: { count: number; changePct: number };
  expiringSoon: { count: number; changePct: number };
  expiredPasses: { count: number; changePct: number };
  todayCollectionPaise: { amount: number; changePct: number };
  monthCollectionPaise: { amount: number; changePct: number };
  newVsRenewalThisMonth: {
    newCount: number;
    renewalCount: number;
    ratioPct: number;
    changePct: number;
  };
}

export interface CollectionTrendItem {
  date: string;
  totalPaise: number;
  cashPaise: number;
  upiPaise: number;
  count: number;
}

export interface GateComparisonItem {
  gateCode: string;
  gateName: string;
  totalPaise: number;
  paymentsCount: number;
  walkersCount: number;
}

export interface PaymentModeSplit {
  cashPaise: number;
  cashCount: number;
  cashPct: number;
  upiPaise: number;
  upiCount: number;
  upiPct: number;
}

export interface RegistrationTrendItem {
  date: string;
  registrations: number;
  renewals: number;
}

export interface DashboardOverviewResponse {
  kpis: DashboardKpis;
  collectionsTrend: CollectionTrendItem[];
  gateComparison: GateComparisonItem[];
  paymentModeSplit: PaymentModeSplit;
  registrationsOverTime: RegistrationTrendItem[];
}
