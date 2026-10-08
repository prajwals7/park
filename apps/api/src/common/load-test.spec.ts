import { describe, it, expect } from 'vitest';
import { executeLoadTest } from '../../../../scripts/load-test.js';

describe('Performance Hardening: Search & Renew Endpoints Load Benchmark', () => {
  it('benchmarks Search and Renew endpoints under high concurrency', async () => {
    const results = await executeLoadTest({
      concurrency: 15,
      totalRequests: 60,
    });

    expect(results.searchResults).toBeDefined();
    expect(results.searchResults.totalRequests).toBe(60);
    expect(results.searchResults.successfulRequests).toBe(60);
    expect(results.searchResults.p95).toBeLessThanOrEqual(250); // Under 250ms

    expect(results.renewResults).toBeDefined();
    expect(results.renewResults.totalRequests).toBe(60);
    expect(results.renewResults.successfulRequests).toBe(60);
    expect(results.renewResults.p95).toBeLessThanOrEqual(300); // Under 300ms
  });
});
