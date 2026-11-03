export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin } from '@/server/security';
import { environment, limitRequest } from '@/server/runtime';
import { createCheckout } from '@/server/payments';
export const POST = apiRoute(async request => {
  requireSameOrigin(request);
  const body = await readJson(request, 4096);
  await limitRequest(request, 'checkout', 12, 900);
  const env = environment();
  return Response.json(await createCheckout(env.DB, env, body));
});
