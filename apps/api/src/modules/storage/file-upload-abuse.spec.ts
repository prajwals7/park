import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from './storage.service.js';
import { MagicBytesUtil } from '../../common/utils/magic-bytes.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('Security Hardening: File-Upload Abuse & IDOR Defense Suite', () => {
  let storageService: StorageService;
  let prisma: any;
  let auditService: any;

  beforeEach(() => {
    prisma = {
      document: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    storageService = new StorageService(prisma as PrismaService, auditService as AuditService);
  });

  describe('1. Magic Byte Inspection vs MIME Spoofing', () => {
    it('detects genuine JPEG magic bytes (FF D8 FF)', () => {
      const genuineJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      expect(MagicBytesUtil.detectMimeType(genuineJpeg)).toBe('image/jpeg');
    });

    it('detects genuine PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
      const genuinePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      expect(MagicBytesUtil.detectMimeType(genuinePng)).toBe('image/png');
    });

    it('detects genuine WebP magic bytes (RIFF ... WEBP)', () => {
      const genuineWebp = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      expect(MagicBytesUtil.detectMimeType(genuineWebp)).toBe('image/webp');
    });

    it('rejects PHP shell script disguised as image/jpeg', async () => {
      const phpShell = Buffer.from("<?php system($_GET['cmd']); ?>");
      const fakeFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: phpShell,
        size: phpShell.length,
        destination: '',
        filename: 'photo.jpg',
        path: '',
        stream: null as any,
      };

      await expect(
        storageService.uploadDocument(fakeFile, 'AADHAAR', 'usr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects executable ELF / EXE headers disguised as image/png', async () => {
      const elfBinary = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(MagicBytesUtil.detectMimeType(elfBinary)).toBeNull();
    });

    it('rejects SVG files containing embedded XSS scripts', async () => {
      const svgXss = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      expect(MagicBytesUtil.detectMimeType(svgXss)).toBeNull();
    });
  });

  describe('2. File Size Abuse & Oversized Buffer Tests', () => {
    it('rejects file buffer exceeding 5MB threshold', async () => {
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      // Add fake JPEG header
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;

      const oversizedFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'huge.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: oversizedBuffer,
        size: oversizedBuffer.length,
        destination: '',
        filename: 'huge.jpg',
        path: '',
        stream: null as any,
      };

      await expect(
        storageService.uploadDocument(oversizedFile, 'TICKET', 'usr-1'),
      ).rejects.toThrow('File size exceeds the 5 MB limit');
    });
  });

  describe('3. Path Traversal & Client Filename Isolation', () => {
    it('isolates storage keys and never reflects path traversal in filename', async () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const traversalFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: '../../../../../../Windows/System32/cmd.exe',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: validJpeg,
        size: validJpeg.length,
        destination: '',
        filename: 'cmd.exe',
        path: '',
        stream: null as any,
      };

      const result = await storageService.uploadDocument(traversalFile, 'PASSPORT', 'usr-1');

      // Must be formatted as documents/passport/<uuid>.jpg
      expect(result.storageKey).toMatch(/^documents\/passport\/[a-f0-9-]+\.jpg$/);
      expect(result.storageKey).not.toContain('..');
      expect(result.storageKey).not.toContain('System32');
    });
  });

  describe('4. Insecure Direct Object Reference (IDOR) Checks', () => {
    it('prevents COLLECTOR from accessing documents belonging to another collector', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-foreign-123',
        type: 'AADHAAR',
        storageKey: 'documents/aadhaar/sample.jpg',
        uploadedById: 'collector-alpha',
        walker: {
          id: 'w-1',
          gateId: 'G1',
          createdById: 'collector-alpha',
        },
      });

      // Collector Beta attempts to read Document of Collector Alpha
      await expect(
        storageService.getSignedDocumentUrl('doc-foreign-123', {
          id: 'collector-beta',
          role: Role.COLLECTOR,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to access documents regardless of uploader', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-foreign-123',
        type: 'AADHAAR',
        storageKey: 'documents/aadhaar/sample.jpg',
        uploadedById: 'collector-alpha',
        walker: {
          id: 'w-1',
          gateId: 'G1',
          createdById: 'collector-alpha',
        },
      });

      const res = await storageService.getSignedDocumentUrl('doc-foreign-123', {
        id: 'admin-super',
        role: Role.ADMIN,
      });

      expect(res.document.id).toBe('doc-foreign-123');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOCUMENT_ACCESSED',
          actorId: 'admin-super',
        }),
      );
    });
  });
});
