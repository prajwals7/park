import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { env } from './common/env.js';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. HTTP Security headers
  app.use(
    helmet({
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. Cookie parser for httpOnly cookies
  app.use(cookieParser());

  // 3. Request body size limit
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // 4. Strict CORS configuration
  app.enableCors({
    origin: [env.CORS_ORIGIN, 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  });

  // 5. Global Standard Error Response Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(env.PORT);
  console.log(`🚀 Walker Pass Desk API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

bootstrap();
