export const GATES = ['G2', 'GS', 'G9'] as const;
export type Gate = (typeof GATES)[number];

export const USER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'COLLECTOR'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const ROLES = USER_ROLES;
export type Role = UserRole;

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PASS_STATUSES = ['ACTIVE', 'EXPIRING', 'EXPIRED'] as const;
export type PassStatus = (typeof PASS_STATUSES)[number];

export const PAYMENT_MODES = ['CASH', 'UPI'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PASS_CONFIG = {
  DURATION_DAYS: 30,
  PRICE_PAISE: 20000, // Rs 200.00
  PRICE_INR: 200,
  EXPIRING_THRESHOLD_DAYS: 7,
  TIMEZONE: 'Asia/Kolkata',
} as const;
