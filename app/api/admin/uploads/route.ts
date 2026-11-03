export const dynamic = 'force-dynamic';
import { apiRoute, requireSameOrigin, requireStaff } from '@/server/security';
import { mediaBucket } from '@/server/runtime';
import { readImageUpload } from '@/server/media';
export const POST = apiRoute(async request => {
  requireSameOrigin(request); const actor = await requireStaff(request);
  const image = await readImageUpload(request);
  await mediaBucket().put(image.key, image.bytes, { httpMetadata: { contentType: image.contentType, cacheControl: 'public,max-age=31536000,immutable' }, customMetadata: { uploadedBy: actor.id } });
  return Response.json({ url: `/api/media/${image.key}` }, { status: 201 });
});
