export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { createSlot, listSlots } from '@/server/dealership';
export const GET = apiRoute(async request => {
  await requireStaff(request);
  return Response.json(await listSlots(database(), true));
});
export const POST = apiRoute(async request => {
  requireSameOrigin(request); const actor = await requireStaff(request);
  return Response.json({ slot: await createSlot(database(), await readJson(request, 4096), actor) }, { status: 201 });
});
