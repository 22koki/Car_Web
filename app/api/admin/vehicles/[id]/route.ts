export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { setVehicleStatus, updateVehicle } from '@/server/dealership';
type Context = { params: Promise<{ id: string }> };
export const PUT = apiRoute<Context>(async (request, context) => {
  requireSameOrigin(request); const actor = await requireStaff(request); const { id } = await context.params;
  return Response.json({ vehicle: await updateVehicle(database(), id, await readJson(request), actor) });
});
export const PATCH = apiRoute<Context>(async (request, context) => {
  requireSameOrigin(request); const actor = await requireStaff(request); const { id } = await context.params;
  return Response.json({ vehicle: await setVehicleStatus(database(), id, await readJson(request, 4096), actor) });
});
