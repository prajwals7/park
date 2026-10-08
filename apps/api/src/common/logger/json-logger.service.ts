import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { AadhaarCryptoUtil } from '../utils/aadhaar-crypto.util.js';
import { env } from '../env.js';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  context?: string;
  message: string;
  trace?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class JsonLoggerService implements LoggerService {
  private isProduction = env.NODE_ENV === 'production';

  private formatMessage(level: LogLevel, message: any, context?: string, trace?: string) {
    const rawMessage = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const sanitizedMessage = AadhaarCryptoUtil.redact(rawMessage);
    const sanitizedTrace = trace ? AadhaarCryptoUtil.redact(trace) : undefined;

    if (this.isProduction) {
      const entry: StructuredLogEntry = {
        timestamp: new Date().toISOString(),
        level,
        context: context || 'Application',
        message: sanitizedMessage,
        ...(sanitizedTrace ? { trace: sanitizedTrace } : {}),
      };
      return JSON.stringify(entry);
    }

    // Local / Dev colorized format
    const time = new Date().toLocaleTimeString();
    const ctx = context ? `[${context}] ` : '';
    return `${time} ${level.toUpperCase().padEnd(5)} ${ctx}${sanitizedMessage}${sanitizedTrace ? `\n${sanitizedTrace}` : ''}`;
  }

  log(message: any, context?: string) {
    console.log(this.formatMessage('log', message, context));
  }

  error(message: any, trace?: string, context?: string) {
    console.error(this.formatMessage('error', message, context, trace));
  }

  warn(message: any, context?: string) {
    console.warn(this.formatMessage('warn', message, context));
  }

  debug?(message: any, context?: string) {
    if (!this.isProduction) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  verbose?(message: any, context?: string) {
    if (!this.isProduction) {
      console.log(this.formatMessage('verbose', message, context));
    }
  }
}
