export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { createVehicle, listVehicles } from '@/server/dealership';
export const GET = apiRoute(async request => {
  await requireStaff(request);
  return Response.json(await listVehicles(database(), true));
});
export const POST = apiRoute(async request => {
  requireSameOrigin(request); const actor = await requireStaff(request);
  return Response.json({ vehicle: await createVehicle(database(), await readJson(request), actor) }, { status: 201 });
});
