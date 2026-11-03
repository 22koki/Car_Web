export const dynamic = 'force-dynamic';
import { apiRoute, requireStaff } from '@/server/security';
import { database } from '@/server/runtime';
import { listEnquiries } from '@/server/dealership';
export const GET = apiRoute(async request => {
  await requireStaff(request);
  return Response.json(await listEnquiries(database()));
});
