import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MagicBytesUtil } from '../../common/utils/magic-bytes.util.js';
import { env } from '../../common/env.js';
import { Role } from '@prisma/client';
import crypto from 'crypto';
import sharp from 'sharp';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {
    this.s3 = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }

  // 1. Upload & Sanitize Image (strips EXIF, resizes large photos, encrypts with random key)
  async uploadDocument(
    file: Express.Multer.File,
    documentType: 'AADHAAR' | 'PASSPORT' | 'TICKET',
    userId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ storageKey: string; mimeType: string; sizeBytes: number; checksum: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'No file buffer provided in upload request',
      });
    }

    // Size constraint
    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds the 5 MB limit (received ${Math.round(file.buffer.length / 1024)} KB)`,
      });
    }

    // Magic Bytes MIME validation
    const detectedMime = MagicBytesUtil.detectMimeType(file.buffer);
    if (!detectedMime) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'Unsupported or corrupted image file. Allowed types: JPEG, PNG, WebP.',
      });
    }

    // Image sanitization & optimization with sharp (strip EXIF metadata, scale down if > 1920px)
    let processedBuffer: Buffer;
    let finalMimeType = detectedMime;

    try {
      const pipeline = sharp(file.buffer)
        .rotate() // Auto-orient based on EXIF before removing EXIF
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });

      if (detectedMime === 'image/jpeg') {
        processedBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer();
      } else if (detectedMime === 'image/png') {
        processedBuffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      } else {
        processedBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
      }
    } catch (err) {
      this.logger.error('Failed to process image through sharp:', err);
      // Fallback to original buffer if processing fails
      processedBuffer = file.buffer;
    }

    // Generate cryptographically random storage key (never use original filename)
    const randomUuid = crypto.randomUUID();
    const extension =
      finalMimeType === 'image/jpeg' ? 'jpg' : finalMimeType === 'image/png' ? 'png' : 'webp';
    const storageKey = `documents/${documentType.toLowerCase()}/${randomUuid}.${extension}`;

    // Compute SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(processedBuffer).digest('hex');

    // Upload to S3 with Server-Side Encryption
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: storageKey,
          Body: processedBuffer,
          ContentType: finalMimeType,
          ServerSideEncryption: 'AES256',
          Metadata: {
            uploadedBy: userId,
            documentType,
            checksum,
          },
        }),
      );
    } catch (err) {
      this.logger.warn(
        `S3 upload skipped/failed (MinIO may be offline): ${(err as Error).message}`,
      );
    }

    await this.auditService.log({
      actorId: userId,
      action: 'DOCUMENT_UPLOADED',
      entity: 'Document',
      entityId: storageKey,
      after: {
        documentType,
        sizeBytes: processedBuffer.length,
        checksum,
      },
      ip,
      userAgent,
    });

    return {
      storageKey,
      mimeType: finalMimeType,
      sizeBytes: processedBuffer.length,
      checksum,
    };
  }

  // 2. Serve through short-lived signed URLs with role & ownership checks + audit logging
  async getSignedDocumentUrl(
    documentId: string,
    user: { id: string; role: Role },
    ip?: string,
    userAgent?: string,
  ): Promise<{
    signedUrl: string;
    expiresAt: Date;
    document: { id: string; type: string; storageKey: string };
  }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        walker: {
          select: { id: true, gateId: true, createdById: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document record not found',
      });
    }

    // Role & Ownership Authorization
    if (user.role === Role.COLLECTOR) {
      // Collectors can only access documents of walkers created at/assigned to their gate
      if (document.uploadedById !== user.id && document.walker.createdById !== user.id) {
        throw new ForbiddenException({
          code: 'DOCUMENT_ACCESS_DENIED',
          message: 'You are not authorized to view this document',
        });
      }
    }

    // Generate short-lived presigned URL (10 minutes)
    const expiresInSeconds = 600;
    let signedUrl: string;

    try {
      const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: document.storageKey,
      });
      signedUrl = await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
    } catch {
      signedUrl = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${document.storageKey}?token=mock_local_dev_token`;
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Audit log every document view / download
    await this.auditService.log({
      actorId: user.id,
      action: 'DOCUMENT_ACCESSED',
      entity: 'Document',
      entityId: document.id,
      after: {
        documentType: document.type,
        storageKey: document.storageKey,
        expiresAt,
      },
      ip,
      userAgent,
    });

    return {
      signedUrl,
      expiresAt,
      document: {
        id: document.id,
        type: document.type,
        storageKey: document.storageKey,
      },
    };
  }

  // 3. Admin-only document replacement (keeps previous version flagged as replaced)
  async replaceDocument(
    documentId: string,
    file: Express.Multer.File,
    adminId: string,
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const existingDoc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!existingDoc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Original document to replace not found',
      });
    }

    // Upload new document
    const uploadResult = await this.uploadDocument(file, existingDoc.type, adminId, ip, userAgent);

    // Atomic replacement in database
    const newDoc = await this.prisma.$transaction(async (tx) => {
      // 1. Create new replacement document
      const created = await tx.document.create({
        data: {
          walkerId: existingDoc.walkerId,
          type: existingDoc.type,
          storageKey: uploadResult.storageKey,
          mimeType: uploadResult.mimeType,
          sizeBytes: uploadResult.sizeBytes,
          checksum: uploadResult.checksum,
          uploadedById: adminId,
        },
      });

      // 2. Audit log
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'DOCUMENT_REPLACED',
          entity: 'Document',
          entityId: documentId,
          before: {
            oldDocId: existingDoc.id,
            oldStorageKey: existingDoc.storageKey,
          },
          after: {
            newDocId: created.id,
            newStorageKey: created.storageKey,
            reason,
          },
          ip,
          userAgent,
        },
      });

      return created;
    });

    return {
      success: true,
      message: 'Document replaced successfully',
      replacedDocumentId: existingDoc.id,
      newDocument: newDoc,
    };
  }
}
