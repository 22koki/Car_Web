export const dynamic = 'force-dynamic';
import { apiRoute } from '@/server/security';
import { database } from '@/server/runtime';
import { listSlots } from '@/server/dealership';
export const GET = apiRoute(async () => Response.json(await listSlots(database())));
