import { z } from 'zod';
import { PASS_STATUSES, PAYMENT_MODES } from './constants.js';
import { phoneSchema } from './auth-schemas.js';

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
    passNo: z.string().trim().min(3).max(30),
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    gateId: z.string().uuid(),
    aadhaarLast4: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'Must be exactly last 4 digits of Aadhaar')
      .optional(),
    notes: z.string().trim().max(500).optional(),
    aadhaarStorageKey: z.string().min(5),
    passportStorageKey: z.string().min(5),
    paymentMode: z.enum(PAYMENT_MODES),
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
  gateId: z.string().uuid(),
  paymentMode: z.enum(PAYMENT_MODES),
  ticketStorageKey: z.string().min(5, 'Ticket document storage key is required'),
});
export type RenewWalkerPassInput = z.infer<typeof renewWalkerPassSchema>;
