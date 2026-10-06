import { z } from 'zod';
import { GATES, PAYMENT_MODES } from './constants.js';

import { phoneSchema } from './auth-schemas.js';

// Walker registration schema
export const registerWalkerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    address: z.string().trim().min(5).max(300),
    aadhaarNumberMasked: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'Must be last 4 digits of Aadhaar')
      .optional(),
    aadhaarPhotoUrl: z.string().url('Aadhaar document URL is required'),
    passportPhotoUrl: z.string().url('Passport photo URL is required'),
    initialGate: z.enum(GATES),
    paymentMode: z.enum(PAYMENT_MODES),
    upiRefNumber: z.string().trim().min(6).max(50).optional(),
    allowDuplicatePhoneOverride: z.boolean().default(false),
    overrideReason: z.string().trim().min(5).max(255).optional(),
  })
  .refine(
    (data) => {
      if (data.paymentMode === 'UPI' && !data.upiRefNumber) {
        return false;
      }
      return true;
    },
    {
      message: 'UPI Reference/UTR number is required for UPI payments',
      path: ['upiRefNumber'],
    },
  )
  .refine(
    (data) => {
      if (data.allowDuplicatePhoneOverride && !data.overrideReason) {
        return false;
      }
      return true;
    },
    {
      message: 'Reason is required when overriding duplicate phone number',
      path: ['overrideReason'],
    },
  );
export type RegisterWalkerInput = z.infer<typeof registerWalkerSchema>;

// Renew pass schema
export const renewPassSchema = z
  .object({
    walkerId: z.string().uuid(),
    gate: z.enum(GATES),
    paymentMode: z.enum(PAYMENT_MODES),
    upiRefNumber: z.string().trim().min(6).max(50).optional(),
    ticketPhotoUrl: z.string().url('Renewal ticket photo URL is required'),
  })
  .refine(
    (data) => {
      if (data.paymentMode === 'UPI' && !data.upiRefNumber) {
        return false;
      }
      return true;
    },
    {
      message: 'UPI Reference/UTR number is required for UPI payments',
      path: ['upiRefNumber'],
    },
  );
export type RenewPassInput = z.infer<typeof renewPassSchema>;

// Search query schema
export const searchWalkerSchema = z.object({
  query: z.string().trim().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
});
export type SearchWalkerInput = z.infer<typeof searchWalkerSchema>;

// Standard API response error envelope
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;

// Standard API success envelope
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}
