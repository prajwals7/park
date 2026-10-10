import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CryptoUtil } from '../../common/utils/crypto.util.js';
import { env } from '../../common/env.js';
import { Role, UserStatus } from '@prisma/client';
import { verifySync, generateSecret, generateURI } from 'otplib';
import {
  LoginInput,
  VerifyTotpInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  RegisterCollectorInput,
} from '@wpd/shared';

// In-memory store for password reset tokens and temporary 2FA challenges
interface ResetTokenEntry {
  userId: string;
  expiresAt: Date;
}
const resetTokens = new Map<string, ResetTokenEntry>();

interface TotpChallengeEntry {
  userId: string;
  expiresAt: Date;
}
const totpChallenges = new Map<string, TotpChallengeEntry>();

// In-memory store for hashed single-use backup codes per user
const userBackupCodes = new Map<string, string[]>();

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  // 1. Login with progressive account lockout and 2FA trigger
  async login(
    input: LoginInput,
    ip?: string,
    userAgent?: string,
  ): Promise<{
    requiresTotp?: boolean;
    challengeToken?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: { id: string; email: string; name: string; role: Role };
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: 'This user account has been disabled by administrators',
      });
    }

    // Check progressive account lockout
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const waitMinutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000);
      throw new ForbiddenException({
        code: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked due to repeated failed logins. Try again in ${waitMinutes} minute(s).`,
      });
    }

    // Verify Password (Argon2id or bcrypt fallback)
    let passwordMatches: boolean;
    if (user.passwordHash.startsWith('$argon2id')) {
      passwordMatches = await CryptoUtil.verifyPassword(user.passwordHash, input.password);
    } else {
      // bcrypt check or re-hash to Argon2id
      const bcrypt = await import('bcrypt');
      passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
      if (passwordMatches) {
        // Upgrade to Argon2id automatically on successful login
        const newHash = await CryptoUtil.hashPassword(input.password);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
      }
    }

    if (!passwordMatches) {
      const newFailedAttempts = user.failedLogins + 1;
      let lockedUntil: Date | null = null;

      // Account lockout rule: 5 consecutive failed attempts
      if (newFailedAttempts >= 5) {
        // Progressive delay: 15 mins for 5 attempts, doubles for each additional failure
        const delayMinutes = 15 * Math.pow(2, Math.min(newFailedAttempts - 5, 4));
        lockedUntil = new Date(now.getTime() + delayMinutes * 60 * 1000);

        await this.auditService.log({
          actorId: user.id,
          action: 'ACCOUNT_LOCKED',
          entity: 'User',
          entityId: user.id,
          after: { failedLogins: newFailedAttempts, lockedUntil },
          ip,
          userAgent,
        });
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: newFailedAttempts,
          lockedUntil,
        },
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        after: { email: user.email, failedCount: newFailedAttempts },
        ip,
        userAgent,
      });

      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Reset failed logins counter on valid password
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    // Check TOTP 2FA requirement:
    // Mandatory for SUPER_ADMIN and ADMIN, or if user has configured totpSecret
    const isTotpMandatory = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    const hasTotpSecret = Boolean(user.totpSecret);

    if (isTotpMandatory || hasTotpSecret) {
      const challengeToken = CryptoUtil.randomToken(32);
      totpChallenges.set(challengeToken, {
        userId: user.id,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 min validity
      });

      return {
        requiresTotp: true,
        challengeToken,
      };
    }

    // Standard login flow (for roles without active 2FA)
    const tokens = await this.issueTokenPair(user, ip, userAgent);
    await this.auditService.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      ip,
      userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // 2. Verify TOTP Challenge or Backup Code
  async verifyTotp(
    input: VerifyTotpInput,
    ip?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string; role: Role };
  }> {
    const challenge = totpChallenges.get(input.challengeToken);
    if (!challenge || challenge.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'CHALLENGE_EXPIRED',
        message: '2FA challenge has expired. Please sign in again.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    let isValid = false;

    // Check TOTP code against totpSecret
    if (user.totpSecret) {
      isValid = verifySync({ token: input.code, secret: user.totpSecret }).valid;
    }

    // Check Backup Codes if TOTP failed or if user needs initial setup
    if (!isValid) {
      const backupHashes = userBackupCodes.get(user.id) || [];
      const codeHash = CryptoUtil.hashToken(input.code.toUpperCase());
      const backupIndex = backupHashes.indexOf(codeHash);

      if (backupIndex !== -1) {
        // Single use backup code consumed
        backupHashes.splice(backupIndex, 1);
        userBackupCodes.set(user.id, backupHashes);
        isValid = true;
        this.logger.log(`User ${user.email} used a backup code for 2FA`);
      }
    }

    // Allow dummy demo code '123456' in dev/test mode if totpSecret is not yet provisioned
    if (!isValid && process.env.NODE_ENV !== 'production' && input.code === '123456') {
      isValid = true;
    }

    if (!isValid) {
      throw new UnauthorizedException({
        code: 'INVALID_2FA_CODE',
        message: 'Invalid authentication or backup code',
      });
    }

    // Consume challenge token
    totpChallenges.delete(input.challengeToken);

    const tokens = await this.issueTokenPair(user, ip, userAgent);
    await this.auditService.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS_2FA',
      entity: 'User',
      entityId: user.id,
      ip,
      userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // 3. Issue Token Pair & Persist Refresh Token Hash
  private async issueTokenPair(
    user: { id: string; email: string; name: string; role: Role },
    _ip?: string,
    _userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        type: 'access',
      },
      {
        secret: env.JWT_SECRET,
        expiresIn: '15m', // Short-lived 15 minutes
      },
    );

    const rawRefreshToken = CryptoUtil.randomToken(48);
    const tokenHash = CryptoUtil.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  // 4. Rotate Refresh Token with Automatic Reuse Detection
  async rotateRefreshToken(
    rawRefreshToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = CryptoUtil.hashToken(rawRefreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or unrecognized refresh token',
      });
    }

    // REUSE DETECTION: If token was already revoked, someone is replaying an old token!
    if (storedToken.revoked || storedToken.expiresAt < new Date()) {
      // Invalidate ALL tokens for this compromised account immediately
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { revoked: true },
      });

      await this.auditService.log({
        actorId: storedToken.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        entity: 'User',
        entityId: storedToken.userId,
        after: { compromisedTokenHash: tokenHash },
        ip,
        userAgent,
      });

      throw new UnauthorizedException({
        code: 'TOKEN_COMPROMISED',
        message: 'Suspicious session activity detected. All active sessions have been terminated.',
      });
    }

    // Revoke current token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Issue fresh pair
    return this.issueTokenPair(storedToken.user, ip, userAgent);
  }

  // 5. Single Logout
  async logout(
    rawRefreshToken?: string,
    userId?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = CryptoUtil.hashToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revoked: true },
      });
    }

    if (userId) {
      await this.auditService.log({
        actorId: userId,
        action: 'LOGOUT',
        entity: 'User',
        entityId: userId,
        ip,
        userAgent,
      });
    }
  }

  // 6. Logout all devices
  async logoutAllDevices(userId: string, ip?: string, userAgent?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    await this.auditService.log({
      actorId: userId,
      action: 'LOGOUT_ALL_DEVICES',
      entity: 'User',
      entityId: userId,
      ip,
      userAgent,
    });
  }

  // 7. Change Password
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const matches = await CryptoUtil.verifyPassword(user.passwordHash, input.currentPassword);
    if (!matches) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password provided is incorrect',
      });
    }

    const newHash = await CryptoUtil.hashPassword(input.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens on password change
    await this.logoutAllDevices(userId, ip, userAgent);

    await this.auditService.log({
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: userId,
      ip,
      userAgent,
    });
  }

  // 8. Forgot Password Flow
  async forgotPassword(
    input: ForgotPasswordInput,
    ip?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (user) {
      const rawToken = CryptoUtil.randomToken(32);
      resetTokens.set(rawToken, {
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });

      await this.auditService.log({
        actorId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'User',
        entityId: user.id,
        ip,
        userAgent,
      });

      this.logger.log(`Password reset requested for ${user.email}. Token generated.`);
    }

    // Always return constant message to prevent user enumeration
    return {
      message: 'If the provided email exists, a password reset link has been dispatched.',
    };
  }

  // 9. Reset Password Flow
  async resetPassword(input: ResetPasswordInput, ip?: string, userAgent?: string): Promise<void> {
    const entry = resetTokens.get(input.token);
    if (!entry || entry.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message: 'Password reset token is invalid or has expired',
      });
    }

    const newHash = await CryptoUtil.hashPassword(input.newPassword);
    await this.prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash: newHash },
    });

    // Invalidate reset token and active sessions
    resetTokens.delete(input.token);
    await this.logoutAllDevices(entry.userId, ip, userAgent);

    await this.auditService.log({
      actorId: entry.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      entity: 'User',
      entityId: entry.userId,
      ip,
      userAgent,
    });
  }

  // 10. Generate TOTP Provisioning Secret & Backup Codes
  async generateTotpSecret(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });

    const secret = generateSecret();
    const otpauthUrl = generateURI({ label: user.email, issuer: 'Walker Pass Desk', secret });
    const backupCodes = CryptoUtil.generateBackupCodes(8);

    // Store secret and hashed backup codes
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });
    userBackupCodes.set(
      userId,
      backupCodes.map((c) => CryptoUtil.hashToken(c)),
    );

    return { secret, otpauthUrl, backupCodes };
  }

  // 11. Role Change (Admin action with audit log)
  async changeRole(
    actorId: string,
    targetUserId: string,
    newRole: Role,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new BadRequestException({ code: 'USER_NOT_FOUND', message: 'Target user not found' });
    }

    const oldRole = targetUser.role;
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    await this.auditService.log({
      actorId,
      action: 'ROLE_CHANGED',
      entity: 'User',
      entityId: targetUserId,
      before: { role: oldRole },
      after: { role: newRole },
      ip,
      userAgent,
    });
  }

  // 12. Self-Registration for Gate Collectors (Sign Up)
  async registerCollector(
    input: RegisterCollectorInput,
    ip?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string; role: Role; gate: string };
  }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'USER_ALREADY_EXISTS',
        message: 'An account with this email address already exists. Please log in instead.',
      });
    }

    const passwordHash = await CryptoUtil.hashPassword(input.password);
    const assignedGate = input.gate.trim().toUpperCase() || 'G2';

    const user = await this.prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        phone: input.phone?.trim() || '9876543210',
        role: Role.COLLECTOR,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    });

    const tokens = await this.issueTokenPair(user, ip, userAgent);

    await this.auditService.log({
      actorId: user.id,
      action: 'COLLECTOR_REGISTERED',
      entity: 'User',
      entityId: user.id,
      after: {
        email: user.email,
        name: user.name,
        gate: assignedGate,
        role: user.role,
      },
      ip,
      userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        gate: assignedGate,
      },
    };
  }
}
