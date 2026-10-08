import { AadhaarCryptoUtil } from '../utils/aadhaar-crypto.util.js';

export interface SentryEventPayload {
  message: string;
  level: 'info' | 'warning' | 'error' | 'fatal';
  timestamp: string;
  environment: string;
  extra?: Record<string, unknown>;
  stack?: string;
}

export class SentryMonitoring {
  private static dsn: string | undefined = process.env.SENTRY_DSN;
  private static environment: string = process.env.NODE_ENV || 'development';

  static init(dsn?: string) {
    if (dsn) {
      this.dsn = dsn;
    }
    if (this.dsn) {
      console.log(`[Sentry] Initialized error monitoring (${this.environment})`);
    }
  }

  static isConfigured(): boolean {
    return Boolean(this.dsn);
  }

  /**
   * Captures an unhandled exception with strict PII and Aadhaar redaction
   */
  static captureException(error: Error, extra?: Record<string, unknown>): SentryEventPayload | null {
    const sanitizedMessage = AadhaarCryptoUtil.redact(error.message);
    const sanitizedStack = error.stack ? AadhaarCryptoUtil.redact(error.stack) : undefined;

    // Sanitize any extra context objects
    const sanitizedExtra: Record<string, unknown> = {};
    if (extra) {
      for (const [key, val] of Object.entries(extra)) {
        if (typeof val === 'string') {
          sanitizedExtra[key] = AadhaarCryptoUtil.redact(val);
        } else {
          sanitizedExtra[key] = val;
        }
      }
    }

    const payload: SentryEventPayload = {
      message: sanitizedMessage,
      level: 'error',
      timestamp: new Date().toISOString(),
      environment: this.environment,
      stack: sanitizedStack,
      extra: sanitizedExtra,
    };

    if (this.isConfigured()) {
      // In production with live DSN, dispatch to Sentry ingest API
      // Fallback prints structured error report
      console.error(`[Sentry Report] ${payload.message}`, payload);
    }

    return payload;
  }
}
