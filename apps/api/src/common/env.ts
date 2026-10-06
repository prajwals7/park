import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root if not already set
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('walker-pass-documents'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_USE_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(customEnv?: Record<string, unknown>): Env {
  const result = envSchema.safeParse(customEnv || process.env);
  if (!result.success) {
    if (process.env.NODE_ENV === 'test') {
      throw new Error(`Invalid environment variables: ${JSON.stringify(result.error.format())}`);
    }
    console.error('❌ FATAL: Invalid environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
}

export const getEnv = () => validateEnv();
export const env = validateEnv();
