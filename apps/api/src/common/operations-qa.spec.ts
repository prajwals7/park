import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService } from '../modules/health/health.service.js';
import { JsonLoggerService } from './logger/json-logger.service.js';
import { SentryMonitoring } from './monitoring/sentry.util.js';
import { createDatabaseBackup } from '../../../../scripts/backup-db.js';
import { restoreDatabase } from '../../../../scripts/restore-db.js';
import { planMigrationRollback } from '../../../../scripts/rollback-migration.js';
import fs from 'fs';
import path from 'path';

describe('Operations, Health, Backup & Monitoring QA Suite', () => {
  describe('1. Health & Readiness Probes', () => {
    let healthService: HealthService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
      };
      healthService = new HealthService(mockPrisma);
    });

    it('returns valid liveness check payload with uptime and timestamp', () => {
      const live = healthService.getLiveness();
      expect(live.status).toBe('ok');
      expect(live.timestamp).toBeDefined();
      expect(live.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(live.version).toBe('1.0.0');
    });

    it('returns healthy readiness check when database ping succeeds', async () => {
      const ready = await healthService.getReadiness();
      expect(ready.status).toBe('ok');
      expect(ready.checks.database.status).toBe('healthy');
      expect(ready.checks.database.latencyMs).toBeDefined();
      expect(ready.checks.storage.status).toBe('healthy');
    });

    it('returns unhealthy status when database query fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));
      const ready = await healthService.getReadiness();
      expect(ready.status).toBe('error');
      expect(ready.checks.database.status).toBe('unhealthy');
      expect(ready.checks.database.error).toContain('Connection terminated');
    });
  });

  describe('2. Structured JSON Logging & Error Monitoring', () => {
    it('redacts Aadhaar numbers before emitting structured logs', () => {
      const logger = new JsonLoggerService();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.log('Walker registration for Aadhaar 367598324511 succeeded');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('XXXX-XXXX-4511'),
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('367598324511'),
      );
      consoleSpy.mockRestore();
    });

    it('sanitizes Sentry event payloads and strips sensitive data', () => {
      const event = SentryMonitoring.captureException(
        new Error('Processing failed for 367598324511'),
        { walkerAadhaar: '367598324511', action: 'renew' },
      );

      expect(event).not.toBeNull();
      if (event) {
        expect(event.message).toContain('XXXX-XXXX-4511');
        expect(event.extra?.walkerAadhaar).toContain('XXXX-XXXX-4511');
        expect(event.message).not.toContain('367598324511');
      }
    });
  });

  describe('3. Managed Database Backup & Tested Restore', () => {
    const testBackupDir = path.resolve(process.cwd(), 'scratch/test-backups');

    let latestBackupResult: any;

    it('creates database backup archive with SHA-256 checksum', async () => {
      process.env.DATABASE_URL = 'postgresql://postgres:postgrespassword@localhost:5432/walker_pass_desk';

      latestBackupResult = await createDatabaseBackup(testBackupDir);

      expect(fs.existsSync(latestBackupResult.backupFile)).toBe(true);
      expect(fs.existsSync(latestBackupResult.checksumFile)).toBe(true);
      expect(latestBackupResult.checksum).toHaveLength(64);

      // Verify checksum file content matches
      const checksumOnDisk = fs.readFileSync(latestBackupResult.checksumFile, 'utf8').trim().split(/\s+/)[0];
      expect(checksumOnDisk).toBe(latestBackupResult.checksum);
    });

    it('verifies restore passes SHA-256 integrity check in dry-run mode', async () => {
      const restoreResult = await restoreDatabase({
        backupFile: latestBackupResult.backupFile,
        checksumFile: latestBackupResult.checksumFile,
        dryRun: true,
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.message).toContain('Dry-run verification passed');
    });

    it('detects and rejects corrupted/tampered backup files during restore', async () => {
      const corruptedFile = path.join(testBackupDir, 'corrupted-backup.sql.gz');
      const checksumFile = path.join(testBackupDir, 'corrupted-backup.sql.gz.sha256');

      fs.writeFileSync(corruptedFile, Buffer.from('Original backup content'));
      fs.writeFileSync(checksumFile, '0000000000000000000000000000000000000000000000000000000000000000  corrupted-backup.sql.gz\n');

      await expect(
        restoreDatabase({
          backupFile: corruptedFile,
          checksumFile,
          dryRun: true,
        }),
      ).rejects.toThrow('Checksum mismatch');
    });
  });

  describe('4. Migration Rollback Planner', () => {
    it('discovers Prisma migrations and outlines rollback strategies', async () => {
      const plans = await planMigrationRollback();
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0]?.migrationName).toBeDefined();
      expect(plans[0]?.appliedAt).toBeDefined();
    });
  });
});
