import { HttpError } from './security-core.ts';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Enforce the actual streamed length, even when Content-Length is omitted or false. */
export async function readBoundedBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, 'This file is too large.', 'request_too_large');
  if (!request.body) throw new HttpError(400, 'A request body is required.', 'request_body_required');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'This file is too large.', 'request_too_large'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export function imageSignature(bytes: Uint8Array): { contentType: string; extension: string } {
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, 'Choose an image no larger than 8 MB.', 'image_size');
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: 'image/jpeg', extension: 'jpg' };
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte) && String.fromCharCode(...bytes.slice(12,16)) === 'IHDR') return { contentType: 'image/png', extension: 'png' };
  if (bytes.length >= 20 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP' && ['VP8 ','VP8L','VP8X'].includes(String.fromCharCode(...bytes.slice(12,16)))) return { contentType: 'image/webp', extension: 'webp' };
  throw new HttpError(415, 'Choose a JPEG, PNG or WebP image. The file contents must match its image type.', 'image_type');
}

export async function readImageUpload(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) throw new HttpError(415, 'Upload the image as multipart form data.', 'content_type');
  const bytes = await readBoundedBytes(request, MAX_IMAGE_BYTES + 65536);
  let form: FormData;
  try { form = await new Request('https://upload.invalid', { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes.buffer as ArrayBuffer }).formData(); }
  catch { throw new HttpError(400, 'This upload could not be read.', 'invalid_upload'); }
  const files = form.getAll('file');
  if (files.length !== 1 || !(files[0] instanceof File)) throw new HttpError(400, 'Upload one image in the file field.', 'image_required');
  const file = files[0];
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, 'Choose an image no larger than 8 MB.', 'image_size');
  const imageBytes = new Uint8Array(await file.arrayBuffer()); const signature = imageSignature(imageBytes);
  if (file.type && file.type !== signature.contentType) throw new HttpError(415, 'The image contents do not match the declared file type.', 'image_type');
  return { bytes: imageBytes, ...signature, key: `vehicle-${crypto.randomUUID()}.${signature.extension}` };
}

export function validMediaKey(key: string): boolean {
  return /^vehicle-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(key);
}
