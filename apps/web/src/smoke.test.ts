import { describe, it, expect } from 'vitest';
import { GATES, PASS_CONFIG } from '@wpd/shared';

describe('Web App Configuration & Shared Integration', () => {
  it('correctly imports shared constants', () => {
    expect(GATES).toEqual(['G2', 'GS', 'G9']);
    expect(PASS_CONFIG.PRICE_PAISE).toBe(20000);
  });
});
