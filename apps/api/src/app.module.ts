import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { WalkersModule } from './modules/walkers/walkers.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { env } from './common/env.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: env.THROTTLE_TTL,
        limit: env.THROTTLE_LIMIT,
      },
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    WalkersModule,
    StorageModule,
    PaymentsModule,
  ],
  providers: [
    // 1. Throttler Guard (Rate limiting)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 2. Default-deny JWT Authentication Guard across all routes
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 3. Global Roles RBAC Guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
