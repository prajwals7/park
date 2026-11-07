import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const DEFAULT_NEON_URL =
  'postgresql://neondb_owner:npg_zYB0ai6wyVWr@ep-falling-math-b3xk03oy-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_NEON_URL;
}

let cachedSql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!cachedSql) {
    const url = getDatabaseUrl();
    cachedSql = neon(url);
  }
  return cachedSql;
}
