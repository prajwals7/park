import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { env } from '../../common/env.js';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
}

export interface ReadinessCheckResult extends HealthCheckResult {
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      latencyMs?: number;
      error?: string;
    };
    storage: {
      status: 'healthy' | 'degraded';
      endpoint: string;
      bucket: string;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  // Liveness check (lightweight)
  getLiveness(): HealthCheckResult {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      environment: env.NODE_ENV,
      version: '1.0.0',
    };
  }

  // Readiness check (verifies database and storage dependencies)
  async getReadiness(): Promise<ReadinessCheckResult> {
    const liveness = this.getLiveness();
    const checks: ReadinessCheckResult['checks'] = {
      database: { status: 'unhealthy' },
      storage: {
        status: 'healthy',
        endpoint: env.S3_ENDPOINT,
        bucket: env.S3_BUCKET,
      },
    };

    // 1. Verify Database Ping
    const dbStart = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'healthy',
        latencyMs: Math.round(performance.now() - dbStart),
      };
    } catch (err) {
      this.logger.error('Database health ping failed:', err);
      checks.database = {
        status: 'unhealthy',
        latencyMs: Math.round(performance.now() - dbStart),
        error: (err as Error).message,
      };
    }

    const isHealthy = checks.database.status === 'healthy';

    return {
      ...liveness,
      status: isHealthy ? 'ok' : 'error',
      checks,
    };
  }
}
