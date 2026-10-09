'use client';

/**
 * Robust, high-performance API client for Walker Pass Desk
 * Automatically manages Authorization headers, JSON serialization, and request timeouts.
 */

export interface ApiResponse<T = any> {
  data?: T;
  success?: boolean;
  message?: string;
  [key: string]: any;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('wpd_auth_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Normalize endpoint URL
  let url = endpoint;
  if (!url.startsWith('http')) {
    if (!url.startsWith('/api/v1')) {
      url = `/api/v1${url.startsWith('/') ? '' : '/'}${url}`;
    }
  }

  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // 10s maximum timeout to prevent UI lag/freezing
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse JSON or return empty object on 204
    if (res.status === 204) {
      return {} as T;
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Request failed with status ${res.status}`);
      }
      return data as T;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed with status ${res.status}`);
    }

    return (await res.text()) as unknown as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your network connection.');
    }
    throw err;
  }
}
