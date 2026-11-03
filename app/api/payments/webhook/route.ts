export const dynamic = 'force-dynamic';
import { apiRoute } from '@/server/security';
import { environment } from '@/server/runtime';
import { readBoundedBytes } from '@/server/media';
import { processWebhook } from '@/server/payments';
export const POST = apiRoute(async request => {
  const bytes = await readBoundedBytes(request, 65536);
  const env = environment();
  return Response.json(await processWebhook(env.DB, env, request.headers, bytes));
});
