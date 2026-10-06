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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
    } else if (exception instanceof Error) {
      // Never leak SQL queries or raw stack traces in production / API responses
      this.logger.error(
        `Unhanded Exception: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );
      code = 'INTERNAL_ERROR';
      message = 'A processing error occurred';
      details = undefined;
    }

    response.status(status).json({
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    });
  }
}
