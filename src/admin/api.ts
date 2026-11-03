export class AdminApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = '') {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

export async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options.body instanceof FormData ? {} : options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new AdminApiError('The server could not be reached. Check your connection and try again.');
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const detail = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : {};
    const message = typeof body.error === 'string' ? body.error : typeof detail.message === 'string' ? detail.message : typeof body.message === 'string' ? body.message : '';
    const code = typeof detail.code === 'string' ? detail.code : typeof body.code === 'string' ? body.code : '';
    throw new AdminApiError(message || `The request could not be completed (${response.status}).`, response.status, code);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AdminApiError('The server returned an unreadable response. Please try again.', response.status);
  return payload as T;
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function displayDate(value: string | null | undefined, timezone = 'Africa/Nairobi', withTime = true): string {
  if (!value) return 'Not specified';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not specified';
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', ...(withTime && !calendarDate ? { timeStyle: 'short' } : {}) };
  try {
    return new Intl.DateTimeFormat('en-KE', { ...options, timeZone: calendarDate ? 'UTC' : timezone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-KE', options).format(date);
  }
}

export function localInputTime(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function titleCase(value: string): string {
  return value.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
