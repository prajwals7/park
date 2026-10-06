import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { env } from './common/env.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: env.THROTTLE_TTL,
        limit: env.THROTTLE_LIMIT,
      },
    ]),
  ],
})
export class AppModule {}
