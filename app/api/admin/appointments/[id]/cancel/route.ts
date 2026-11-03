export const dynamic = 'force-dynamic';
import { apiRoute, requireSameOrigin, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { cancelAppointment } from '@/server/dealership';
type Context = { params: Promise<{ id: string }> };
export const POST = apiRoute<Context>(async (request, context) => {
  requireSameOrigin(request); const actor = await requireStaff(request); const { id } = await context.params;
  return Response.json({ appointment: await cancelAppointment(database(), id, actor) });
});
