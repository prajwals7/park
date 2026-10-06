import { describe, it, expect } from 'vitest';
import { envSchema } from './env.js';

describe('API Environment Schema', () => {
  it('validates a correct environment configuration', () => {
    const valid = {
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/walker_pass_desk',
      JWT_SECRET: 'super_secret_jwt_key_with_sufficient_length_32',
      S3_ENDPOINT: 'http://localhost:9000',
    };
    const parsed = envSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects short JWT secrets', () => {
    const invalid = {
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/walker_pass_desk',
      JWT_SECRET: 'short',
    };
    const parsed = envSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});
