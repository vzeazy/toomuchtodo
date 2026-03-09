export type ApiEndpoint =
  | 'session'
  | 'sign-up'
  | 'sign-in'
  | 'sign-out'
  | 'bootstrap'
  | 'push'
  | 'pull';

interface ApiErrorResponse {
  error?: string;
  code?: string;
  message?: string;
  retryable?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  requestId: string | null;
  status: number;
  retryCount: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly endpoint: ApiEndpoint,
    readonly status: number | null,
    readonly requestId: string | null,
    readonly serverCode: string | null,
    readonly retryable: boolean,
    readonly retryCount: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const withBase = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim();
  return `${base}${path}`;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

const parseErrorResponse = async (response: Response) => {
  try {
    return await response.json() as ApiErrorResponse;
  } catch {
    return null;
  }
};

const formatErrorMessage = (
  endpoint: ApiEndpoint,
  status: number | null,
  requestId: string | null,
  detail: string | null,
) => {
  const statusPart = typeof status === 'number' ? `${status}` : 'network';
  return `${endpoint} failed (${statusPart}${detail ? `: ${detail}` : ''}${requestId ? `, request ${requestId}` : ''})`;
};

interface RequestJsonOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  retries?: number;
  retryBaseMs?: number;
}

export const requestJson = async <T>(
  endpoint: ApiEndpoint,
  path: string,
  options: RequestJsonOptions = {},
): Promise<ApiResponse<T>> => {
  const retries = options.retries ?? 0;
  const retryBaseMs = options.retryBaseMs ?? 150;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(withBase(path), {
        method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
        credentials: 'include',
        headers: options.body !== undefined ? { 'content-type': 'application/json' } : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      const requestId = response.headers.get('x-request-id');
      if (!response.ok) {
        const parsed = await parseErrorResponse(response);
        const serverCode = parsed?.code || parsed?.error || null;
        const retryable = parsed?.retryable ?? isRetryableStatus(response.status);
        if (retryable && attempt < retries) {
          const delayMs = retryBaseMs * (2 ** attempt) + Math.floor(Math.random() * retryBaseMs);
          await sleep(delayMs);
          continue;
        }
        throw new ApiError(
          formatErrorMessage(endpoint, response.status, requestId, parsed?.message || serverCode),
          endpoint,
          response.status,
          requestId,
          serverCode,
          retryable,
          attempt,
        );
      }

      return {
        data: await response.json() as T,
        requestId,
        status: response.status,
        retryCount: attempt,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      const retryable = attempt < retries;
      if (retryable) {
        const delayMs = retryBaseMs * (2 ** attempt) + Math.floor(Math.random() * retryBaseMs);
        await sleep(delayMs);
        continue;
      }

      throw new ApiError(
        formatErrorMessage(endpoint, null, null, error instanceof Error ? error.message : 'Unknown error'),
        endpoint,
        null,
        null,
        null,
        true,
        attempt,
      );
    }
  }

  throw new ApiError(`${endpoint} failed`, endpoint, null, null, null, true, retries);
};
