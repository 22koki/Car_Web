import { env } from 'cloudflare:workers';
import { assertSameOrigin, HttpError, readBoundedJson, sessionForRequest, staffForRequest, validPrivateKey } from './security-core';

export { HttpError } from './security-core';
export type { StaffActor } from './security-core';

export function requireSameOrigin(request: Request): void { assertSameOrigin(request, env); }
export async function requireStaff(request: Request) { return staffForRequest(request, env); }
export function getSession(request: Request) { return sessionForRequest(request, env); }
export function readJson(request: Request, maxBytes?: number) { return readBoundedJson(request, maxBytes); }
export function getPrivateKey(): string {
  if (!validPrivateKey(env.PRIVATE_API_KEY)) throw new HttpError(503, 'Secure enquiry handling is being configured. Please try again shortly.', 'server_configuration');
  return env.PRIVATE_API_KEY;
}

export function apiRoute<TContext = unknown>(handler: (request: Request, context: TContext) => Response | Promise<Response>) {
  return async (request: Request, context: TContext): Promise<Response> => {
    try {
      const response = await handler(request, context);
      if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      return response;
    } catch (error) {
      const known = error instanceof HttpError;
      if (!known) console.error('Dealership request failed', { path: new URL(request.url).pathname, errorType: error instanceof Error ? error.name : 'unknown' });
      return Response.json({ error: known ? error.message : 'Something went wrong. Please try again.', code: known ? error.code : 'server_error' }, {
        status: known ? error.status : 500,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      });
    }
  };
}
