export const dynamic = 'force-dynamic';
import { apiRoute, getPrivateKey, readJson, requireSameOrigin } from '@/server/security';
import { database, limitRequest } from '@/server/runtime';
import { createEnquiry } from '@/server/dealership';
export const POST = apiRoute(async request => {
  requireSameOrigin(request);
  const body = await readJson(request, 16384);
  await limitRequest(request, 'enquiries', 8, 900);
  return Response.json(await createEnquiry(database(), body, getPrivateKey()), { status: 201 });
});
