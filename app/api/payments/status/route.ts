export const dynamic = 'force-dynamic';
import { apiRoute } from '@/server/security';
import { database, limitRequest } from '@/server/runtime';
import { paymentStatus } from '@/server/payments';
export const GET = apiRoute(async request => {
  await limitRequest(request, 'payment-status', 90, 600);
  return Response.json(await paymentStatus(database(), new URL(request.url).searchParams.get('reference')));
});
