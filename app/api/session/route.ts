import { apiRoute, getSession } from '../../../server/security';
export const dynamic = 'force-dynamic';
export const GET = apiRoute(async request => Response.json(getSession(request)));
