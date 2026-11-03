export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin, requireStaff } from '@/server/security';
import { environment } from '@/server/runtime';
import { getConfig, updateSettings } from '@/server/dealership';
export const GET = apiRoute(async request => {
  await requireStaff(request); const env = environment();
  return Response.json(await getConfig(env.DB, env));
});
export const PATCH = apiRoute(async request => {
  requireSameOrigin(request); const actor = await requireStaff(request); const env = environment();
  await updateSettings(env.DB, await readJson(request, 8192), actor);
  return Response.json(await getConfig(env.DB, env));
});
