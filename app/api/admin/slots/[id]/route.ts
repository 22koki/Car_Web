export const dynamic = 'force-dynamic';
import { apiRoute, requireSameOrigin, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { closeSlot } from '@/server/dealership';
type Context = { params: Promise<{ id: string }> };
export const DELETE = apiRoute<Context>(async (request, context) => {
  requireSameOrigin(request); const actor = await requireStaff(request); const { id } = await context.params;
  return Response.json({ slot: await closeSlot(database(), id, actor) });
});
