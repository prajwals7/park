import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { env } from './common/env.js';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers & CORS
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  // Global standard error response format
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(env.PORT);
  console.log(`🚀 Walker Pass Desk API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

bootstrap();
