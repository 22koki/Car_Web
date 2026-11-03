export const dynamic = 'force-dynamic';
import { apiRoute, HttpError } from '@/server/security';
import { mediaBucket } from '@/server/runtime';
import { validMediaKey } from '@/server/media';
type Context = { params: Promise<{ key: string }> };
export const GET = apiRoute<Context>(async (request, context) => {
  const { key } = await context.params;
  if (!validMediaKey(key)) throw new HttpError(404, 'This image was not found.', 'image_not_found');
  const object = await mediaBucket().get(key);
  if (!object) throw new HttpError(404, 'This image was not found.', 'image_not_found');
  const headers = new Headers({ 'ETag': object.httpEtag, 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' });
  object.writeHttpMetadata(headers);
  if (request.headers.get('if-none-match') === object.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
});
