import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createWalkerSchema,
  renewWalkerPassSchema,
  listWalkersQuerySchema,
  VerhoeffUtil,
  receiptNoSchema,
  passNoSchema,
} from '@wpd/shared';
import { WalkersService } from './walkers.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AadhaarCryptoUtil } from '../../common/utils/aadhaar-crypto.util.js';

describe('Security Hardening: Input Fuzzing, Injection & Mass-Assignment Suite', () => {
  let walkersService: WalkersService;
  let prisma: any;
  let auditService: any;

  beforeEach(() => {
    prisma = {
      walker: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
      pass: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      payment: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      gate: {
        findUnique: vi.fn().mockResolvedValue({ id: 'G2', code: 'G2', name: 'South Gate', isActive: true }),
      },
      $transaction: vi.fn(),
    };
    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    walkersService = new WalkersService(prisma as PrismaService, auditService as AuditService);
  });

  describe('1. SQL Injection Fuzzing on Search and Filters', () => {
    const sqliPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE walkers; --",
      "' UNION SELECT null, null, username, password FROM users --",
      "1; SELECT pg_sleep(5); --",
      "admin'--",
      "' OR 1=1/*",
    ];

    it('safely handles SQL injection payloads in search query schema', () => {
      for (const payload of sqliPayloads) {
        const parsed = listWalkersQuerySchema.safeParse({
          search: payload,
          page: 1,
          limit: 10,
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.search).toBe(payload);
        }
      }
    });

    it('executes parameterized Prisma searches without SQL execution side effects', async () => {
      for (const payload of sqliPayloads) {
        await walkersService.listWalkers({
          page: 1,
          limit: 10,
          search: payload,
        });

        expect(prisma.walker.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { name: { contains: payload, mode: 'insensitive' } },
              ]),
            }),
          }),
        );
      }
    });
  });

  describe('2. XSS & Script Tag Fuzzing', () => {
    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert(1)>",
      "javascript:alert(document.cookie)",
      "<svg onload=alert`1`>",
      "'\"><script src=//evil.com/x.js></script>",
    ];

    it('validates receiptNo rejects non-alphanumeric/hyphen XSS injection strings', () => {
      for (const payload of xssPayloads) {
        const res = receiptNoSchema.safeParse(payload);
        expect(res.success).toBe(false);
      }
    });

    it('validates passNo rejects dangerous characters', () => {
      for (const payload of xssPayloads) {
        const res = passNoSchema.safeParse(payload);
        // Special symbols in scripts fail uppercase alphanumeric pass pattern
        expect(res.success).toBe(false);
      }
    });
  });

  describe('3. Giant Payload / Buffer Overflow Boundary Tests', () => {
    it('rejects oversized inputs in phone and receipt schemas', () => {
      const giantString = 'A'.repeat(10000);
      expect(receiptNoSchema.safeParse(giantString).success).toBe(false);

      const giantPhone = '9845012345' + '9'.repeat(500);
      const res = createWalkerSchema.safeParse({
        name: 'Valid Name',
        phone: giantPhone,
        gateId: 'G2',
        aadhaar: '367598324511',
        passNo: 'WP-1001',
        payment: {
          mode: 'CASH',
          receiptNo: 'RC-1001',
          ticketStorageKey: 'uploads/t.jpg',
        },
      });
      expect(res.success).toBe(false);
    });
  });

  describe('4. Null Bytes and Binary Control Characters', () => {
    it('rejects null bytes in receiptNo and phone', () => {
      expect(receiptNoSchema.safeParse('RC-10\001').success).toBe(false);
      expect(createWalkerSchema.safeParse({
        name: 'Test\0User',
        phone: '98450\01234',
        gateId: '11111111-1111-1111-1111-111111111111',
        aadhaarNumber: '367598324511',
        consentAgreed: true,
        aadhaarStorageKey: 'documents/aadhaar/valid.jpg',
        passportStorageKey: 'documents/photo/valid.jpg',
        paymentMode: 'CASH',
        receiptNo: 'RC-1001',
        passNo: 'WP-1001',
      }).success).toBe(false);
    });
  });

  describe('5. Mass-Assignment & Prototype Pollution Defense', () => {
    it('strips malicious unknown keys and proto injection from Zod payloads', () => {
      const maliciousPayload = {
        name: 'Legitimate Name',
        phone: '9845012345',
        gateId: '11111111-1111-1111-1111-111111111111',
        aadhaarNumber: '367598324511',
        consentAgreed: true,
        aadhaarStorageKey: 'documents/aadhaar/valid.jpg',
        passportStorageKey: 'documents/photo/valid.jpg',
        paymentMode: 'CASH',
        receiptNo: 'RC-1001',
        passNo: 'WP-1001',
        // Injected fields attempting mass assignment
        role: 'SUPER_ADMIN',
        isAdmin: true,
        deletedAt: null,
        __proto__: { polluted: true },
      };

      const parsed = createWalkerSchema.parse(maliciousPayload);

      // Verify injected keys are stripped by schema validation
      expect((parsed as any).role).toBeUndefined();
      expect((parsed as any).isAdmin).toBeUndefined();
      expect((parsed as any).deletedAt).toBeUndefined();
      expect(({} as any).polluted).toBeUndefined();
    });
  });

  describe('6. Verhoeff Checksum Mutation & Tamper Detection', () => {
    it('detects every single-digit transcription error in valid 12-digit Aadhaar', () => {
      const validAadhaar = '367598324511';
      expect(VerhoeffUtil.validate(validAadhaar)).toBe(true);

      // Mutate each digit position 0..11 to every other digit
      for (let i = 0; i < 12; i++) {
        for (let digit = 0; digit <= 9; digit++) {
          if (String(digit) === validAadhaar[i]) continue;
          const mutated = validAadhaar.slice(0, i) + String(digit) + validAadhaar.slice(i + 1);
          expect(VerhoeffUtil.validate(mutated)).toBe(false);
        }
      }
    });

    it('detects all adjacent transposition errors in Aadhaar', () => {
      const validAadhaar = '367598324511';
      for (let i = 0; i < 11; i++) {
        if (validAadhaar[i] === validAadhaar[i + 1]) continue;
        const transposed =
          validAadhaar.slice(0, i) +
          validAadhaar[i + 1] +
          validAadhaar[i] +
          validAadhaar.slice(i + 2);
        expect(VerhoeffUtil.validate(transposed)).toBe(false);
      }
    });
  });
});
