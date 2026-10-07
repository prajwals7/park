import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VerhoeffUtil, aadhaarSchema, formatMaskedAadhaar } from '@wpd/shared';
import { AadhaarCryptoUtil } from './aadhaar-crypto.util.js';
import { WalkersService } from '../../modules/walkers/walkers.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../modules/audit/audit.service.js';
import { Role } from '@prisma/client';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CryptoUtil } from './crypto.util.js';

describe('Aadhaar Security, Encryption, and Reveal Suite', () => {
  const masterKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const hmacSecret = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  const validAadhaar = '367598324511'; // Valid 12 digits, starts >= 2, Verhoeff checksum valid

  describe('1. Verhoeff Checksum & Zod Validation', () => {
    it('validates a correct 12-digit Aadhaar number with valid checksum', () => {
      expect(VerhoeffUtil.validate(validAadhaar)).toBe(true);
      expect(aadhaarSchema.safeParse(validAadhaar).success).toBe(true);
    });

    it('rejects numbers starting with 0 or 1', () => {
      expect(aadhaarSchema.safeParse('067598324510').success).toBe(false);
      expect(aadhaarSchema.safeParse('167598324510').success).toBe(false);
    });

    it('rejects numbers with invalid checksum', () => {
      // Alter last digit
      expect(aadhaarSchema.safeParse('367598324519').success).toBe(false);
    });

    it('formats masked Aadhaar correctly by default (XXXX XXXX 1234)', () => {
      expect(formatMaskedAadhaar('4510')).toBe('XXXX XXXX 4510');
      expect(formatMaskedAadhaar(null)).toBe('XXXX XXXX XXXX');
    });
  });

  describe('2. Field-Level AES-256-GCM Envelope Encryption & HMAC Indexing', () => {
    it('encrypts and decrypts accurately with key versioning', () => {
      const encrypted = AadhaarCryptoUtil.encrypt(validAadhaar, 'v1', masterKey);
      expect(encrypted).not.toContain(validAadhaar);
      expect(encrypted).toContain('"keyVersion":"v1"');

      const decrypted = AadhaarCryptoUtil.decrypt(encrypted, masterKey);
      expect(decrypted).toBe(validAadhaar);
    });

    it('generates consistent HMAC-SHA256 blind hash for duplicate checking', () => {
      const hash1 = AadhaarCryptoUtil.hashForDuplicateCheck(validAadhaar, hmacSecret);
      const hash2 = AadhaarCryptoUtil.hashForDuplicateCheck(validAadhaar, hmacSecret);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('successfully rotates key to a new version', () => {
      const newMasterKey = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
      const originalEncrypted = AadhaarCryptoUtil.encrypt(validAadhaar, 'v1', masterKey);

      const rotatedEncrypted = AadhaarCryptoUtil.rotate(
        originalEncrypted,
        masterKey,
        newMasterKey,
        'v2',
      );
      expect(rotatedEncrypted).toContain('"keyVersion":"v2"');

      const decrypted = AadhaarCryptoUtil.decrypt(rotatedEncrypted, newMasterKey);
      expect(decrypted).toBe(validAadhaar);
    });

    it('redacts any 12-digit Aadhaar patterns from logs and strings', () => {
      const rawLog = `Processing walker with Aadhaar 367598324510 failed due to timeout`;
      const redacted = AadhaarCryptoUtil.redact(rawLog);
      expect(redacted).not.toContain('367598324510');
      expect(redacted).toContain('XXXX-XXXX-4510');
    });
  });

  interface MockPrismaSecurity {
    walker: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    pass: { create: ReturnType<typeof vi.fn> };
    payment: { count: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    document: { createMany: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  }

  interface MockAuditSecurity {
    log: ReturnType<typeof vi.fn>;
  }

  describe('3. Registration, Exposure Rules & Reveal Endpoint', () => {
    let walkersService: WalkersService;
    let mockPrisma: MockPrismaSecurity;
    let mockAuditService: MockAuditSecurity;

    beforeEach(() => {
      mockPrisma = {
        walker: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
        },
        user: {
          findUnique: vi.fn(),
        },
        pass: { create: vi.fn() },
        payment: { count: vi.fn(), create: vi.fn() },
        document: { createMany: vi.fn() },
        auditLog: { create: vi.fn() },
        $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
      };

      mockAuditService = {
        log: vi.fn().mockResolvedValue(undefined),
      };

      walkersService = new WalkersService(
        mockPrisma as unknown as PrismaService,
        mockAuditService as unknown as AuditService,
      );
    });

    it('rejects registration when duplicate Aadhaar HMAC hash exists', async () => {
      mockPrisma.walker.findUnique.mockResolvedValue(null);
      // Duplicate Aadhaar hash found!
      mockPrisma.walker.findFirst.mockResolvedValue({
        id: 'w-existing',
        name: 'Prior Walker',
        passNo: 'WPD-2026-1001',
      });

      await expect(
        walkersService.createWalker(
          {
            passNo: 'WPD-2026-2000',
            name: 'New Person',
            phone: '9845011111',
            gateId: '11111111-1111-1111-1111-111111111111',
            aadhaarNumber: validAadhaar,
            consentAgreed: true,
            aadhaarStorageKey: 'docs/aadhaar.jpg',
            passportStorageKey: 'docs/photo.jpg',
            paymentMode: 'CASH',
            allowDuplicatePhoneOverride: false,
          },
          'collector-1',
          Role.COLLECTOR,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('strictly forbids COLLECTOR from revealing full Aadhaar (403 Forbidden)', async () => {
      await expect(
        walkersService.revealAadhaar(
          'w-1',
          { id: 'collector-1', role: Role.COLLECTOR },
          { reason: 'Check ID proof', password: 'password123' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to reveal full Aadhaar after password re-auth and writes audit log', async () => {
      const encrypted = AadhaarCryptoUtil.encrypt(validAadhaar);
      const passwordHash = await CryptoUtil.hashPassword('ValidAdminPass@123');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@park.gov.in',
        role: Role.ADMIN,
        passwordHash,
      });

      mockPrisma.walker.findUnique.mockResolvedValue({
        id: 'w-1',
        name: 'Sample Walker',
        aadhaarEncrypted: encrypted,
        aadhaarLast4: '4511',
        deletedAt: null,
      });

      const res = await walkersService.revealAadhaar(
        'w-1',
        { id: 'admin-1', role: Role.ADMIN },
        { reason: 'Police verification request', password: 'ValidAdminPass@123' },
      );

      expect(res.fullAadhaar).toBe(validAadhaar);
      expect(res.maskedAadhaar).toBe('XXXX XXXX 4511');
      expect(res.expiresAt).toBeDefined();

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AADHAAR_REVEALED',
          actorId: 'admin-1',
          entityId: 'w-1',
          after: expect.objectContaining({
            reason: 'Police verification request',
            aadhaarLast4: '4511',
          }),
        }),
      );
    });
  });
});
