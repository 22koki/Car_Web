export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Same-origin browser requests. Merchant secrets never enter the client. */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('API requests must use a same-origin API path.');
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const onAbort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(path, { ...init, headers, credentials: 'same-origin', signal: controller.signal });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const value = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
      const detail = value.error && typeof value.error === 'object' ? value.error as Record<string, unknown> : {};
      const message = typeof detail.message === 'string' ? detail.message : typeof value.message === 'string' ? value.message : typeof value.error === 'string' ? value.error : response.status === 401 ? 'Please sign in and try again.' : 'The request could not be completed. Please try again.';
      const code = typeof detail.code === 'string' ? detail.code : typeof value.code === 'string' ? value.code : undefined;
      throw new ApiError(message, response.status, code);
    }
    if (payload === null) throw new ApiError('The server returned an unreadable response. Please try again.', response.status);
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError('The request timed out. Please try again; your request will not be duplicated.', 408);
    throw new ApiError('We could not reach the showroom. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', onAbort);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function safeCheckoutUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('The payment provider returned an invalid address. Please contact the dealership.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.flutterwave.com' || url.username || url.password || url.port) {
    throw new Error('The payment provider returned an unexpected address. Please contact the dealership.');
  }
  return url.href;
}
