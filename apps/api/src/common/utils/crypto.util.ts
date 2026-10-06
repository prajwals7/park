import argon2 from 'argon2';
import crypto from 'crypto';

export class CryptoUtil {
  // Argon2id hashing with OWASP-recommended parameters
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  }

  static async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  // SHA-256 hash for tokens (refresh tokens, backup codes, reset tokens)
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Generate cryptographic random string (e.g. 32 bytes hex)
  static randomToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  // Generate 8-digit backup codes for TOTP
  static generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}
