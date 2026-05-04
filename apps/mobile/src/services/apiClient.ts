import { mobileEnv } from '../config/env';
import { getSessionToken } from './sessionStorage';
import { getFirebaseIdToken } from './firebaseAuth';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

type ApiErrorPayload = {
  error?: string;
  errorRo?: string;
  code?: string;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

const buildApiUrl = (path: string) => {
  const configuredBase = mobileEnv.apiBaseUrl;
  const looksLikeLocalhost = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredBase);
  const baseSource =
    looksLikeLocalhost && mobileEnv.apiBaseUrlDevice ? mobileEnv.apiBaseUrlDevice : configuredBase;
  const base = baseSource.endsWith('/') ? baseSource : `${baseSource}/`;
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${clean}`;
};

const performRequest = async <T>(path: string, options?: ApiRequestOptions): Promise<T> => {
  const headers: Record<string, string> = {};

  if (options?.auth) {
    const firebaseToken = await getFirebaseIdToken(true);
    if (firebaseToken) {
      headers['Authorization'] = `Bearer ${firebaseToken}`;
    } else {
      const sessionToken = await getSessionToken();
      if (sessionToken) {
        headers['x-session-token'] = sessionToken;
      }
    }
  }

  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(4000, mobileEnv.storefrontTimeoutMs),
  );

  let response: Response;
  try {
    const hasBody = typeof options?.body !== 'undefined';
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    response = await fetch(buildApiUrl(path), {
      method: options?.method ?? 'GET',
      headers,
      ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiRequestError(
        'Serverul răspunde prea greu. Încearcă din nou.',
        408,
        'REQUEST_TIMEOUT',
      );
    }

    throw new ApiRequestError('Nu s-a putut realiza conexiunea la server.', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }

  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;

  if (!response.ok) {
    const message = payload.errorRo ?? payload.error ?? `Cererea a eșuat (${response.status})`;
    throw new ApiRequestError(message, response.status, payload.code);
  }

  return payload;
};

export const apiRequest = async <T>(path: string, options?: ApiRequestOptions): Promise<T> => {
  const maxRetries = 2;
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await performRequest<T>(path, options);
    } catch (error) {
      lastError = error as Error;
      const isRetryable =
        error instanceof ApiRequestError &&
        (error.status >= 500 || error.status === 408 || error.code === 'NETWORK_ERROR');
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError!;
};
