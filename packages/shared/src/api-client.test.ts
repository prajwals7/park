import { describe, it, expect, vi } from 'vitest';
import { ApiClient, ApiClientError } from './api-client.js';

describe('ApiClient & Session Refresh Suite', () => {
  it('attaches Bearer token and JSON headers automatically', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ success: true, data: { id: 'walker-1' } }),
    });

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      getToken: () => 'my-access-token',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.request<{ success: boolean; data: { id: string } }>(
      '/api/v1/walkers/walker-1',
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/walkers/walker-1',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    const callHeaders = mockFetch.mock.calls[0]![1].headers as Headers;
    expect(callHeaders.get('Authorization')).toBe('Bearer my-access-token');
    expect(callHeaders.get('Content-Type')).toBe('application/json');
    expect(res.data.id).toBe('walker-1');
  });

  it('parses standard error { code, message, details } into ApiClientError', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({
        code: 'VALIDATION_ERROR',
        message: 'Invalid physical receipt number',
        details: [{ path: ['receiptNo'], message: 'Too short' }],
      }),
    });

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(client.request('/api/v1/walkers')).rejects.toThrowError(ApiClientError);

    try {
      await client.request('/api/v1/walkers');
    } catch (err) {
      const apiErr = err as ApiClientError;
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.message).toBe('Invalid physical receipt number');
      expect(apiErr.statusCode).toBe(400);
      expect(apiErr.details).toBeDefined();
    }
  });

  it('automatically intercepts 401, refreshes session, and retries request', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
      callCount++;
      const headers = opts.headers as Headers;
      const auth = headers.get('Authorization');

      if (auth === 'Bearer initial-token') {
        // Expired token response
        return {
          ok: false,
          status: 401,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ code: 'UNAUTHORIZED', message: 'Token expired' }),
        };
      }

      // Refreshed token response
      if (auth === 'Bearer refreshed-token') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ success: true, message: 'Retried successfully' }),
        };
      }

      return { ok: false, status: 500 };
    });

    let currentToken = 'initial-token';
    const mockRefreshToken = vi.fn().mockImplementation(async () => {
      currentToken = 'refreshed-token';
      return 'refreshed-token';
    });
    const mockSetToken = vi.fn();
    const mockOnAuthFailure = vi.fn();

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      getToken: () => currentToken,
      setToken: mockSetToken,
      refreshToken: mockRefreshToken,
      onAuthFailure: mockOnAuthFailure,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.request<{ success: boolean; message: string }>('/api/v1/walkers');

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockSetToken).toHaveBeenCalledWith('refreshed-token');
    expect(callCount).toBe(2);
    expect(res.message).toBe('Retried successfully');
    expect(mockOnAuthFailure).not.toHaveBeenCalled();
  });

  it('triggers onAuthFailure callback and throws SESSION_EXPIRED if refresh fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ code: 'UNAUTHORIZED', message: 'Token expired' }),
    });

    const mockRefreshToken = vi.fn().mockRejectedValue(new Error('Refresh token revoked'));
    const mockOnAuthFailure = vi.fn();

    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      getToken: () => 'expired-token',
      refreshToken: mockRefreshToken,
      onAuthFailure: mockOnAuthFailure,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(client.request('/api/v1/walkers')).rejects.toThrowError(ApiClientError);
    expect(mockOnAuthFailure).toHaveBeenCalledTimes(1);
  });
});
