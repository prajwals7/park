import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AadhaarCryptoUtil } from '../utils/aadhaar-crypto.util.js';
import { SentryMonitoring } from '../monitoring/sentry.util.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred. Please contact the administrator.';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const errorObj = res as Record<string, unknown>;
        code = (errorObj['code'] as string) || exception.name;
        message = (errorObj['message'] as string) || exception.message;
        details = errorObj['details'];
      } else {
        message = String(res);
        code = exception.name;
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Request validation failed';
      details = exception.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE_RESOURCE';
        const target = (exception.meta?.['target'] as string[]) || [];
        message = `A resource with the specified unique field (${target.join(', ')}) already exists.`;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'RESOURCE_NOT_FOUND';
        message = 'Requested record was not found.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        code = 'DATABASE_CONSTRAINT_VIOLATION';
        message = 'Database operation failed constraints.';
      }
      this.logger.warn(`[${requestId}] Prisma Error: ${exception.code} - ${exception.message}`);
    } else if (exception instanceof Error) {
      const sanitizedMessage = AadhaarCryptoUtil.redact(exception.message);
      this.logger.error(
        `[${requestId}] Unhandled Server Error: ${sanitizedMessage}`,
        exception.stack ? AadhaarCryptoUtil.redact(exception.stack) : undefined,
        `${request.method} ${request.url}`,
      );
      // Capture in Sentry error monitoring
      SentryMonitoring.captureException(exception, {
        requestId,
        method: request.method,
        url: request.url,
      });
      code = 'INTERNAL_ERROR';
      message = 'An unexpected server error occurred. Please retry later.';
      details = undefined;
    }

    response.status(status).json({
      code,
      message: AadhaarCryptoUtil.redact(message),
      ...(details !== undefined ? { details } : {}),
    });
  }
}
