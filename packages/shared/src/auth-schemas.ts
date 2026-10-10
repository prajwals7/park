import { z } from 'zod';
import { USER_ROLES } from './constants.js';

// Phone number: 10 digits starting with 6-9
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number');

// Strict password policy:
// At least 8 characters, min 1 uppercase, min 1 lowercase, min 1 number, min 1 special symbol
export const passwordPolicySchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must not exceed 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Login Input Schema
export const loginSchema = z.object({
  email: z.string().trim().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// TOTP Verify Input Schema
export const verifyTotpSchema = z.object({
  challengeToken: z.string().min(10, 'Challenge token is required'),
  code: z.string().trim().min(6).max(8, 'Code must be 6-digit TOTP or 8-digit backup code'),
});
export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;

// Change Password Schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordPolicySchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Forgot Password Schema
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Reset Password Schema
export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  newPassword: passwordPolicySchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Setup TOTP Verify Schema
export const setupTotpVerifySchema = z.object({
  code: z.string().trim().length(6, 'Must be a 6-digit TOTP code'),
});
export type SetupTotpVerifyInput = z.infer<typeof setupTotpVerifySchema>;

// Change Role Schema (Admin only)
export const changeUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;

// Collector Self-Registration (Sign Up) Schema
export const registerCollectorSchema = z.object({
  name: z.string().trim().min(2, 'Collector name must be at least 2 characters').max(100),
  email: z.string().trim().email('Must be a valid email address').toLowerCase(),
  phone: phoneSchema.optional().or(z.literal('')),
  gate: z.string().trim().min(2, 'Assigned entry gate is required'),
  password: passwordPolicySchema,
});
export type RegisterCollectorInput = z.infer<typeof registerCollectorSchema>;

