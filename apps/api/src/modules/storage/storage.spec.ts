import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from './storage.service.js';
import { MagicBytesUtil } from '../../common/utils/magic-bytes.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

interface MockStoragePrisma {
  document: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

describe('Secure Document Storage Suite', () => {
  let storageService: StorageService;
  let mockPrisma: MockStoragePrisma;
  let mockAuditService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPrisma = {
      document: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    };

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    storageService = new StorageService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
    );
  });

  describe('Magic Bytes MIME Detection', () => {
    it('accurately identifies genuine JPEG magic bytes (FF D8 FF)', () => {
      const jpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);
      expect(MagicBytesUtil.detectMimeType(jpegBuffer)).toBe('image/jpeg');
    });

    it('accurately identifies genuine PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      expect(MagicBytesUtil.detectMimeType(pngBuffer)).toBe('image/png');
    });

    it('accurately identifies genuine WebP magic bytes (RIFF...WEBP)', () => {
      const webpBuffer = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // 'RIFF'
        0x00,
        0x00,
        0x00,
        0x00, // file size
        0x57,
        0x45,
        0x42,
        0x50, // 'WEBP'
      ]);
      expect(MagicBytesUtil.detectMimeType(webpBuffer)).toBe('image/webp');
    });

    it('detects and rejects fake/spoofed file extensions (e.g., text script renamed as photo.jpg)', () => {
      const fakeBuffer = Buffer.from('<!DOCTYPE html><html><body>malicious payload</body></html>');
      expect(MagicBytesUtil.detectMimeType(fakeBuffer)).toBeNull();
    });
  });

  describe('Upload Constraints & Security Enforcement', () => {
    it('rejects oversized files exceeding 5 MB limit', async () => {
      const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5 MB
      const fakeFile = {
        buffer: oversizedBuffer,
        originalname: 'large_aadhaar.jpg',
      } as unknown as Express.Multer.File;

      await expect(storageService.uploadDocument(fakeFile, 'AADHAAR', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects wrong/corrupted file types upon upload', async () => {
      const textBuffer = Buffer.from('This is not an image');
      const fakeFile = {
        buffer: textBuffer,
        originalname: 'fake.png',
      } as unknown as Express.Multer.File;

      await expect(storageService.uploadDocument(fakeFile, 'PASSPORT', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Access Control & Short-Lived Signed URLs', () => {
    it('denies access to COLLECTOR when document does not belong to collector’s assigned walker', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        type: 'AADHAAR',
        storageKey: 'documents/aadhaar/secret.jpg',
        uploadedById: 'other-collector',
        walker: {
          id: 'w-1',
          gateId: 'gate-other',
          createdById: 'other-collector',
        },
      });

      await expect(
        storageService.getSignedDocumentUrl('doc-1', {
          id: 'collector-unauthorized',
          role: Role.COLLECTOR,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to access any document and records audit log', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        type: 'AADHAAR',
        storageKey: 'documents/aadhaar/sample.jpg',
        uploadedById: 'someone',
        walker: {
          id: 'w-1',
          createdById: 'someone',
        },
      });

      const res = await storageService.getSignedDocumentUrl('doc-1', {
        id: 'admin-1',
        role: Role.ADMIN,
      });

      expect(res.signedUrl).toBeDefined();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOCUMENT_ACCESSED',
          actorId: 'admin-1',
          entityId: 'doc-1',
        }),
      );
    });

    it('throws NotFoundException for non-existent document ID', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(
        storageService.getSignedDocumentUrl('doc-missing', {
          id: 'admin-1',
          role: Role.ADMIN,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
