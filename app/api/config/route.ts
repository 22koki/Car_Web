export const dynamic = 'force-dynamic';
import { apiRoute } from '@/server/security';
import { environment } from '@/server/runtime';
import { getConfig } from '@/server/dealership';
export const GET = apiRoute(async () => { const env = environment(); return Response.json(await getConfig(env.DB, env)); });
