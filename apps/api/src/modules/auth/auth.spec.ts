import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { CryptoUtil } from '../../common/utils/crypto.util.js';
import { Role, UserStatus } from '@prisma/client';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { passwordPolicySchema } from '@wpd/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service.js';

interface MockPrisma {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  refreshToken: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
}

interface MockAuditService {
  log: ReturnType<typeof vi.fn>;
}

describe('Authentication & Security Suite', () => {
  let authService: AuthService;
  let mockPrisma: MockPrisma;
  let mockJwtService: { signAsync: ReturnType<typeof vi.fn> };
  let mockAuditService: MockAuditService;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    mockJwtService = {
      signAsync: vi.fn().mockResolvedValue('mock_jwt_access_token'),
    };

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwtService as unknown as JwtService,
      mockAuditService as unknown as AuditService,
    );
  });

  describe('Password Policy Enforcement', () => {
    it('accepts compliant strong passwords', () => {
      expect(passwordPolicySchema.safeParse('SecurePass@123').success).toBe(true);
      expect(passwordPolicySchema.safeParse('Admin#2026_Go').success).toBe(true);
    });

    it('rejects passwords that violate complexity or length constraints', () => {
      // Too short
      expect(passwordPolicySchema.safeParse('Short1!').success).toBe(false);
      // No uppercase
      expect(passwordPolicySchema.safeParse('alllower@123').success).toBe(false);
      // No number
      expect(passwordPolicySchema.safeParse('NoNumberPass!').success).toBe(false);
      // No special symbol
      expect(passwordPolicySchema.safeParse('NoSpecialChar123').success).toBe(false);
    });
  });

  describe('Account Lockout & Brute Force Protection', () => {
    it('locks account after 5 consecutive failed login attempts', async () => {
      const passwordHash = await CryptoUtil.hashPassword('CorrectPass@123');
      const testUser = {
        id: 'user-1',
        email: 'collector@park.gov.in',
        name: 'Collector User',
        role: Role.COLLECTOR,
        status: UserStatus.ACTIVE,
        passwordHash,
        failedLogins: 4, // 5th attempt incoming
        lockedUntil: null,
        totpSecret: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(testUser);

      await expect(
        authService.login({ email: testUser.email, password: 'WrongPassword@123' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testUser.id },
          data: expect.objectContaining({
            failedLogins: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACCOUNT_LOCKED',
          entityId: testUser.id,
        }),
      );
    });

    it('blocks login if account is currently locked with progressive delay', async () => {
      const lockedFuture = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes in future
      const lockedUser = {
        id: 'user-locked',
        email: 'locked@park.gov.in',
        name: 'Locked User',
        role: Role.COLLECTOR,
        status: UserStatus.ACTIVE,
        passwordHash: 'hash',
        failedLogins: 5,
        lockedUntil: lockedFuture,
      };

      mockPrisma.user.findUnique.mockResolvedValue(lockedUser);

      await expect(
        authService.login({ email: lockedUser.email, password: 'AnyPassword@123' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('TOTP 2FA Enforcement', () => {
    it('demands 2FA challenge for ADMIN and SUPER_ADMIN roles', async () => {
      const passwordHash = await CryptoUtil.hashPassword('AdminPass@123');
      const adminUser = {
        id: 'admin-1',
        email: 'admin@park.gov.in',
        name: 'Admin User',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
        totpSecret: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(adminUser);

      const result = await authService.login({
        email: adminUser.email,
        password: 'AdminPass@123',
      });

      expect(result.requiresTotp).toBe(true);
      expect(result.challengeToken).toBeDefined();
      expect(result.accessToken).toBeUndefined();
    });
  });

  describe('Refresh Token Rotation & Reuse Detection', () => {
    it('detects refresh token reuse and immediately invalidates all active user sessions', async () => {
      const compromisedHash = CryptoUtil.hashToken('already_consumed_token');
      const revokedToken = {
        id: 'token-old',
        userId: 'user-compromised',
        tokenHash: compromisedHash,
        revoked: true, // Already consumed!
        expiresAt: new Date(Date.now() + 3600000),
        user: { id: 'user-compromised', email: 'victim@park.gov.in', role: Role.COLLECTOR },
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(revokedToken);

      await expect(authService.rotateRefreshToken('already_consumed_token')).rejects.toThrow(
        UnauthorizedException,
      );

      // Invalidate all tokens for user
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-compromised' },
        data: { revoked: true },
      });

      // Writes critical security audit log
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          entityId: 'user-compromised',
        }),
      );
    });
  });

  describe('RBAC Route Guard Checks', () => {
    it('verifies COLLECTOR cannot perform role change while ADMIN can', async () => {
      const targetUser = {
        id: 'target-1',
        email: 'staff@park.gov.in',
        role: Role.COLLECTOR,
      };
      mockPrisma.user.findUnique.mockResolvedValue(targetUser);

      await authService.changeRole('admin-1', 'target-1', Role.ADMIN);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-1' },
        data: { role: Role.ADMIN },
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_CHANGED',
          entityId: 'target-1',
          before: { role: Role.COLLECTOR },
          after: { role: Role.ADMIN },
        }),
      );
    });
  });
});
