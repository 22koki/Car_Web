/** Framework-independent request guards, also exercised by the Node test suite. */
export interface SecurityEnvironment {
  STAFF_EMAILS?: string;
  PRIVATE_API_KEY?: string;
  SITE_URL?: string;
}
export interface StaffActor { id: string; email: string; displayName: string; method: 'chatgpt' | 'service' }

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = 'request_failed') {
    super(message); this.name = 'HttpError'; this.status = status; this.code = code;
  }
}

export function validPrivateKey(value: string | undefined): value is string {
  return !!value && value.length >= 32 && value.length <= 512
    && !/^(replace|example|your[-_ ]|change[-_ ]|test[-_ ])/i.test(value);
}

/** Constant work for equal-length bounded secrets; never logs a credential. */
export function equalSecret(left: string, right: string): boolean {
  if (left.length > 512 || right.length > 512) return false;
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function hasServiceAccess(request: Request, environment: SecurityEnvironment): boolean {
  if (!validPrivateKey(environment.PRIVATE_API_KEY)) return false;
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  return equalSecret(authorization.slice(7), environment.PRIVATE_API_KEY);
}

function identity(request: Request): Omit<StaffActor, 'method'> | null {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (!id || !email) return null;
  let name = email;
  const fullName = request.headers.get('oai-authenticated-user-full-name');
  if (fullName && request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(fullName); } catch { /* Email remains the safe display fallback. */ }
  }
  return { id, email: email.trim().toLowerCase(), displayName: name };
}

export function sessionForRequest(request: Request, environment: SecurityEnvironment) {
  const user = identity(request);
  const allowed = new Set((environment.STAFF_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
  if (hasServiceAccess(request, environment)) return { authenticated: true, staff: true, displayName: 'Dealership service' };
  return { authenticated: !!user, staff: !!user && allowed.has(user.email), displayName: user?.displayName || '', ...(user ? { email: user.email } : {}) };
}

export function staffForRequest(request: Request, environment: SecurityEnvironment): StaffActor {
  if (hasServiceAccess(request, environment)) return { id: 'dealership-service', email: '', displayName: 'Dealership service', method: 'service' };
  const user = identity(request);
  if (!user) throw new HttpError(401, 'Sign in to access the dealership workspace.', 'sign_in_required');
  if (!sessionForRequest(request, environment).staff) throw new HttpError(403, 'This account does not have dealership staff access.', 'staff_required');
  return { ...user, method: 'chatgpt' };
}

export function assertSameOrigin(request: Request, environment: SecurityEnvironment): void {
  if (hasServiceAccess(request, environment)) return;
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') throw new HttpError(403, 'Open this form on the dealership website before submitting.', 'origin_required');
  const allowedOrigins = new Set([new URL(request.url).origin]);
  if (environment.SITE_URL) {
    try { allowedOrigins.add(new URL(environment.SITE_URL).origin); } catch { /* Invalid configuration never broadens access. */ }
  }
  try {
    const parsed = new URL(origin);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.origin !== origin || !allowedOrigins.has(parsed.origin)) throw new Error('untrusted');
  } catch { throw new HttpError(403, 'This submission did not originate from the dealership website.', 'origin_mismatch'); }
}

export async function readBoundedJson(request: Request, maxBytes = 65536): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Send this request as JSON.', 'content_type');
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, 'This request is too large.', 'request_too_large');
  if (!request.body) throw new HttpError(400, 'The request body is required.', 'invalid_json');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new HttpError(413, 'This request is too large.', 'request_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, 'The request body must contain valid JSON.', 'invalid_json'); }
}
