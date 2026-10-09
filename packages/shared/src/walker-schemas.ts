import { z } from 'zod';
import { PASS_STATUSES, PAYMENT_MODES } from './constants.js';
import { phoneSchema } from './auth-schemas.js';
import { VerhoeffUtil } from './verhoeff.js';

// Strict 12-digit Indian Aadhaar validation:
// 1. Exactly 12 digits (optional spaces permitted in input)
// 2. Cannot start with 0 or 1
// 3. Verhoeff checksum algorithm must validate
export const aadhaarSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/\s+/g, ''))
  .refine((val) => /^[2-9]\d{11}$/.test(val), {
    message: 'Aadhaar must be exactly 12 digits and cannot start with 0 or 1',
  })
  .refine((val) => VerhoeffUtil.validate(val), {
    message: 'Invalid Aadhaar number: failed Verhoeff checksum validation',
  });

// Masked Aadhaar format helper: XXXX XXXX 1234
export function formatMaskedAadhaar(last4?: string | null): string {
  if (!last4 || last4.length !== 4) return 'XXXX XXXX XXXX';
  return `XXXX XXXX ${last4}`;
}

// Physical Receipt Number Schema:
// 3 to 20 characters, trimmed and uppercased, uppercase letters, digits, and hyphens only
export const receiptNoSchema = z
  .string({ required_error: 'Physical receipt number is required' })
  .trim()
  .transform((val) => val.toUpperCase())
  .refine((val) => val.length >= 3 && val.length <= 20, {
    message: 'Receipt number must be between 3 and 20 characters',
  })
  .refine((val) => /^[A-Z0-9-]+$/.test(val), {
    message: 'Receipt number must contain only uppercase letters, numbers, and hyphens',
  });

// Physical Pass Number Schema: 3 to 30 characters, alphanumeric and hyphens only
export const passNoSchema = z
  .string({ required_error: 'Physical pass number is required' })
  .trim()
  .min(3, 'Pass number must be at least 3 characters')
  .max(30, 'Pass number cannot exceed 30 characters')
  .regex(/^[A-Za-z0-9-]+$/, 'Pass number must contain only letters, numbers, and hyphens');

// Query filters schema for listing walkers
export const listWalkersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(PASS_STATUSES).optional(),
  gateId: z.string().uuid().optional(),
  expiryStart: z.string().datetime().optional(),
  expiryEnd: z.string().datetime().optional(),
  sortBy: z.enum(['expiryDate', 'createdAt', 'name']).default('expiryDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export type ListWalkersQueryInput = z.infer<typeof listWalkersQuerySchema>;

// Register walker input schema
export const createWalkerSchema = z
  .object({
    passNo: passNoSchema,
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    gateId: z.string().trim().min(2),
    aadhaarNumber: aadhaarSchema,
    consentAgreed: z.literal(true, {
      errorMap: () => ({ message: 'Walker consent for storing ID proof is mandatory' }),
    }),
    notes: z.string().trim().max(500).optional(),
    aadhaarStorageKey: z.string().min(5),
    passportStorageKey: z.string().min(5),
    paymentMode: z.enum(PAYMENT_MODES, {
      errorMap: () => ({ message: 'Payment mode is required and must be CASH or UPI' }),
    }),
    receiptNo: receiptNoSchema,
    allowDuplicatePhoneOverride: z.boolean().default(false),
    overrideReason: z.string().trim().min(5).max(255).optional(),
  })
  .refine(
    (data) => {
      if (data.allowDuplicatePhoneOverride && !data.overrideReason) {
        return false;
      }
      return true;
    },
    {
      message: 'Override reason is mandatory when overriding phone number',
      path: ['overrideReason'],
    },
  );
export type CreateWalkerInput = z.infer<typeof createWalkerSchema>;

// Admin reveal Aadhaar schema (requires re-auth password or 2FA code)
export const revealAadhaarSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, 'Reason for accessing sensitive Aadhaar is mandatory')
      .max(300),
    password: z.string().min(1, 'Password confirmation is required').optional(),
    totpCode: z.string().trim().length(6).optional(),
  })
  .refine((data) => Boolean(data.password || data.totpCode), {
    message: 'Either current password or 2FA code is required to reveal Aadhaar',
    path: ['password'],
  });
export type RevealAadhaarInput = z.infer<typeof revealAadhaarSchema>;

// Update walker (Admin only)
export const updateWalkerSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: phoneSchema.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  gateId: z.string().uuid().optional(),
  aadhaarLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
});
export type UpdateWalkerInput = z.infer<typeof updateWalkerSchema>;

// Soft delete walker input
export const softDeleteWalkerSchema = z.object({
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(300),
});
export type SoftDeleteWalkerInput = z.infer<typeof softDeleteWalkerSchema>;

// Renew pass input
export const renewWalkerPassSchema = z.object({
  gateId: z.string().trim().min(2),
  paymentMode: z.enum(PAYMENT_MODES, {
    errorMap: () => ({ message: 'Payment mode is required and must be CASH or UPI' }),
  }),
  receiptNo: receiptNoSchema,
  ticketStorageKey: z.string().min(5, 'Ticket document storage key is required'),
});
export type RenewWalkerPassInput = z.infer<typeof renewWalkerPassSchema>;

// Admin correction of physical payment receipt number or payment mode
export const correctPaymentSchema = z
  .object({
    receiptNo: receiptNoSchema.optional(),
    mode: z
      .enum(PAYMENT_MODES, {
        errorMap: () => ({ message: 'Payment mode must be CASH or UPI' }),
      })
      .optional(),
    reason: z
      .string({ required_error: 'Correction reason is required' })
      .trim()
      .min(5, 'Correction reason must be at least 5 characters')
      .max(300, 'Correction reason cannot exceed 300 characters'),
  })
  .refine((data) => Boolean(data.receiptNo || data.mode), {
    message: 'At least one of physical receipt number or payment mode must be provided',
    path: ['receiptNo'],
  });
export type CorrectPaymentInput = z.infer<typeof correctPaymentSchema>;
