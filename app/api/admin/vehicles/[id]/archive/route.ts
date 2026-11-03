export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { archiveVehicle } from '@/server/dealership';
type Context = { params: Promise<{ id: string }> };
export const POST = apiRoute<Context>(async (request, context) => {
  requireSameOrigin(request); const actor = await requireStaff(request); const { id } = await context.params;
  const body = request.body ? await readJson(request, 4096) : undefined;
  return Response.json({ vehicle: await archiveVehicle(database(), id, actor, body) });
});
