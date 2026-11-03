const encoder = new TextEncoder();

export async function hashText(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hmacBytes(secret: string, value: string | Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes as BufferSource));
}

export async function receiptFor(secret: string, enquiryId: string, idempotencyKey: string): Promise<string> {
  const bytes = await hmacBytes(secret, `velocity:enquiry-receipt:v1:${enquiryId}:${idempotencyKey}`);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function base64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}
