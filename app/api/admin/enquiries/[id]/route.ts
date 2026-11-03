export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { updateEnquiry } from '@/server/dealership';
type Context = { params: Promise<{ id: string }> };
export const PATCH = apiRoute<Context>(async (request, context) => {
  requireSameOrigin(request); const actor = await requireStaff(request); const { id } = await context.params;
  return Response.json({ enquiry: await updateEnquiry(database(), id, await readJson(request, 16384), actor) });
});
