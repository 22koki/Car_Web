export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { seedDemo } from '@/server/dealership';
export const POST = apiRoute(async request => {
  requireSameOrigin(request); const actor = await requireStaff(request);
  return Response.json(await seedDemo(database(), await readJson(request, 4096), actor));
});
