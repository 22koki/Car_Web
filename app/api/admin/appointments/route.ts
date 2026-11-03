export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { confirmAppointment, listAppointments } from '@/server/dealership';
export const GET = apiRoute(async request => {
  await requireStaff(request);
  return Response.json(await listAppointments(database()));
});
export const POST = apiRoute(async request => {
  requireSameOrigin(request); const actor = await requireStaff(request);
  return Response.json({ appointment: await confirmAppointment(database(), await readJson(request, 4096), actor) }, { status: 201 });
});
