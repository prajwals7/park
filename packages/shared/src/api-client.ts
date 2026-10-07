import { LoginInput, VerifyTotpInput, ChangePasswordInput } from './auth-schemas.js';
import {
  CreateWalkerInput,
  UpdateWalkerInput,
  ListWalkersQueryInput,
  RenewWalkerPassInput,
  RevealAadhaarInput,
  CorrectPaymentInput,
} from './walker-schemas.js';
import {
  CollectionsReportQueryInput,
  ExpiriesReportQueryInput,
  CashReconciliationQueryInput,
  RecordCashReconciliationInput,
  ReceiptRegisterQueryInput,
  ExportQueryInput,
} from './report-schemas.js';
import {
  CreateUserInput,
  UpdateUserStatusInput,
  AdminResetPasswordInput,
  Force2faInput,
  ListUsersQueryInput,
  CreateGateInput,
  UpdateGateInput,
  UpdateSettingsInput,
  AuditLogsQueryInput,
  ExportWalkersQueryInput,
  DashboardOverviewQueryInput,
  DashboardOverviewResponse,
} from './admin-schemas.js';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  setToken?: (token: string | null) => void | Promise<void>;
  onAuthFailure?: () => void;
  refreshToken?: () => Promise<string | null>;
  fetchFn?: typeof fetch;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken?: () => string | null | Promise<string | null>;
  private readonly setToken?: (token: string | null) => void | Promise<void>;
  private readonly onAuthFailure?: () => void;
  private readonly refreshTokenFn?: () => Promise<string | null>;
  private readonly fetch: typeof fetch;
  private isRefreshing = false;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getToken = config.getToken;
    this.setToken = config.setToken;
    this.onAuthFailure = config.onAuthFailure;
    this.refreshTokenFn = config.refreshToken;
    this.fetch = config.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Core request dispatcher with automatic Authorization header injection,
   * standard error parsing, and seamless session refresh on 401.
   */
  async request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers || {});

    // Ensure content type defaults to application/json for non-FormData
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Attach Bearer token if available
    if (!headers.has('Authorization') && this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    let response: Response;
    try {
      response = await this.fetch(url, { ...options, headers });
    } catch (networkError: unknown) {
      const msg = networkError instanceof Error ? networkError.message : 'Network request failed';
      throw new ApiClientError('NETWORK_ERROR', msg, 0);
    }

    // Handle 401 Unauthorized with token refresh mechanism
    if (response.status === 401 && !isRetry && this.refreshTokenFn && !this.isRefreshing) {
      this.isRefreshing = true;
      try {
        const newToken = await this.refreshTokenFn();
        if (newToken && this.setToken) {
          await this.setToken(newToken);
        }
        this.isRefreshing = false;
        // Retry original request with refreshed token
        return this.request<T>(endpoint, options, true);
      } catch (refreshErr) {
        this.isRefreshing = false;
        if (this.onAuthFailure) {
          this.onAuthFailure();
        }
        throw new ApiClientError(
          'SESSION_EXPIRED',
          'Session expired. Please log in again.',
          401,
          refreshErr,
        );
      }
    }

    // Parse Response
    const contentType = response.headers.get('Content-Type') || '';
    let parsedBody: unknown;

    if (contentType.includes('application/json')) {
      try {
        parsedBody = await response.json();
      } catch {
        parsedBody = null;
      }
    } else {
      parsedBody = await response.text();
    }

    if (!response.ok) {
      if (typeof parsedBody === 'object' && parsedBody !== null) {
        const errorObj = parsedBody as { code?: string; message?: string; details?: unknown };
        const code = errorObj.code || `HTTP_${response.status}`;
        const message = errorObj.message || response.statusText || 'Request failed';
        throw new ApiClientError(code, message, response.status, errorObj.details);
      }
      throw new ApiClientError(
        `HTTP_${response.status}`,
        typeof parsedBody === 'string' && parsedBody ? parsedBody : response.statusText,
        response.status,
      );
    }

    return parsedBody as T;
  }

  // ==========================================
  // Auth Namespace
  // ==========================================
  readonly auth = {
    login: (input: LoginInput) =>
      this.request<{
        accessToken?: string;
        refreshToken?: string;
        user?: { id: string; name: string; role: string };
        requires2FA?: boolean;
        tempToken?: string;
      }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    verifyTotp: (input: VerifyTotpInput) =>
      this.request<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; name: string; role: string };
      }>('/api/v1/auth/totp/verify', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    refresh: (refreshToken: string) =>
      this.request<{ accessToken: string; refreshToken: string }>('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),

    logout: () =>
      this.request<{ success: boolean }>('/api/v1/auth/logout', {
        method: 'POST',
      }),

    changePassword: (input: ChangePasswordInput) =>
      this.request<{ message: string }>('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  };

  // ==========================================
  // Walkers Namespace
  // ==========================================
  readonly walkers = {
    list: (query: Partial<ListWalkersQueryInput> = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) searchParams.set(k, String(v));
      });
      return this.request<{
        total: number;
        page: number;
        limit: number;
        data: Array<Record<string, unknown>>;
      }>(`/api/v1/walkers?${searchParams.toString()}`);
    },

    get: (id: string) => this.request<Record<string, unknown>>(`/api/v1/walkers/${id}`),

    create: (input: CreateWalkerInput, idempotencyKey?: string) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['x-idempotency-key'] = idempotencyKey;
      }
      return this.request<Record<string, unknown>>('/api/v1/walkers', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
    },

    update: (id: string, input: UpdateWalkerInput) =>
      this.request<Record<string, unknown>>(`/api/v1/walkers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),

    delete: (id: string, reason: string) =>
      this.request<{ success: boolean }>(`/api/v1/walkers/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      }),

    restore: (id: string) =>
      this.request<{ success: boolean }>(`/api/v1/walkers/${id}/restore`, {
        method: 'POST',
      }),

    renew: (id: string, input: RenewWalkerPassInput, idempotencyKey?: string) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['x-idempotency-key'] = idempotencyKey;
      }
      return this.request<Record<string, unknown>>(`/api/v1/walkers/${id}/renew`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
    },

    revealAadhaar: (id: string, input: RevealAadhaarInput) =>
      this.request<{ fullAadhaar: string }>(`/api/v1/walkers/${id}/reveal-aadhaar`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    export: (query: Partial<ExportWalkersQueryInput> = {}) => {
      const sp = new URLSearchParams();
      if (!query.format) sp.set('format', 'csv');
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) sp.set(k, String(v));
      });
      return `${this.baseUrl}/api/v1/walkers/export?${sp.toString()}`;
    },
  };

  // ==========================================
  // Payments Namespace
  // ==========================================
  readonly payments = {
    correct: (id: string, input: CorrectPaymentInput) =>
      this.request<Record<string, unknown>>(`/api/v1/payments/${id}/correct`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),

    getReceipt: (id: string, format?: 'json' | 'html') =>
      this.request<Record<string, unknown> | string>(
        `/api/v1/payments/${id}/receipt${format === 'html' ? '?format=html' : ''}`,
      ),
  };

  // ==========================================
  // Reports Namespace (Admin Only)
  // ==========================================
  readonly reports = {
    getCollections: (query: CollectionsReportQueryInput = { period: 'daily' }) => {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) sp.set(k, String(v));
      });
      return this.request<Record<string, unknown>>(`/api/v1/reports/collections?${sp.toString()}`);
    },

    getExpiries: (query: ExpiriesReportQueryInput = { status: 'EXPIRING', page: 1, limit: 50 }) => {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) sp.set(k, String(v));
      });
      return this.request<{
        total: number;
        page: number;
        limit: number;
        data: Array<Record<string, unknown>>;
      }>(`/api/v1/reports/expiries?${sp.toString()}`);
    },

    getCashReconciliation: (query: CashReconciliationQueryInput = {}) => {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) sp.set(k, String(v));
      });
      return this.request<Record<string, unknown>>(
        `/api/v1/reports/cash-reconciliation?${sp.toString()}`,
      );
    },

    recordCashReconciliation: (input: RecordCashReconciliationInput) =>
      this.request<Record<string, unknown>>('/api/v1/reports/cash-reconciliation', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    getReceiptRegister: (query: ReceiptRegisterQueryInput = { page: 1, limit: 100 }) => {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) sp.set(k, String(v));
      });
      return this.request<{
        total: number;
        detectedGapsCount: number;
        detectedGaps: Array<Record<string, unknown>>;
        records: Array<Record<string, unknown>>;
      }>(`/api/v1/reports/receipt-register?${sp.toString()}`);
    },

    exportPayments: (query: ExportQueryInput) => {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) sp.set(k, String(v));
      });
      return `${this.baseUrl}/api/v1/reports/export/payments?${sp.toString()}`;
    },
  };

  // ==========================================
  // Admin Namespace (Admin Only)
  // ==========================================
  readonly admin = {
    getDashboard: (query: DashboardOverviewQueryInput = { range: '7d' }) => {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) sp.set(k, String(v));
      });
      return this.request<DashboardOverviewResponse>(`/api/v1/admin/dashboard?${sp.toString()}`);
    },

    listUsers: (query: Partial<ListUsersQueryInput> = {}) => {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) sp.set(k, String(v));
      });
      return this.request<{
        total: number;
        page: number;
        limit: number;
        data: Array<Record<string, unknown>>;
      }>(`/api/v1/admin/users?${sp.toString()}`);
    },

    createUser: (input: CreateUserInput) =>
      this.request<Record<string, unknown>>('/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    updateUserStatus: (id: string, input: UpdateUserStatusInput) =>
      this.request<Record<string, unknown>>(`/api/v1/admin/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),

    resetUserPassword: (id: string, input: AdminResetPasswordInput) =>
      this.request<{ message: string }>(`/api/v1/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    force2fa: (id: string, input: Force2faInput) =>
      this.request<{ message: string }>(`/api/v1/admin/users/${id}/force-2fa`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),

    listGates: () =>
      this.request<Array<Record<string, unknown>>>('/api/v1/admin/gates'),

    createGate: (input: CreateGateInput) =>
      this.request<Record<string, unknown>>('/api/v1/admin/gates', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    updateGate: (id: string, input: UpdateGateInput) =>
      this.request<Record<string, unknown>>(`/api/v1/admin/gates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),

    getSettings: () =>
      this.request<Record<string, unknown>>('/api/v1/admin/settings'),

    updateSettings: (input: UpdateSettingsInput) =>
      this.request<Record<string, unknown>>('/api/v1/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),

    listAuditLogs: (query: Partial<AuditLogsQueryInput> = {}) => {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) sp.set(k, String(v));
      });
      return this.request<{
        total: number;
        page: number;
        limit: number;
        data: Array<Record<string, unknown>>;
      }>(`/api/v1/audit-logs?${sp.toString()}`);
    },

    exportAuditLogs: (query: Partial<AuditLogsQueryInput> = {}) => {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) sp.set(k, String(v));
      });
      return `${this.baseUrl}/api/v1/audit-logs/export?${sp.toString()}`;
    },
  };
}
