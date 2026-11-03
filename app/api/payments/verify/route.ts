export const dynamic = 'force-dynamic';
import { apiRoute, readJson, requireSameOrigin } from '@/server/security';
import { environment, limitRequest } from '@/server/runtime';
import { verifyPayment } from '@/server/payments';
export const POST = apiRoute(async request => {
  requireSameOrigin(request);
  const body = await readJson(request, 4096);
  await limitRequest(request, 'payment-verify', 20, 600);
  const env = environment();
  return Response.json(await verifyPayment(env.DB, env, body));
});
