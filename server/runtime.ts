import { env } from 'cloudflare:workers';
import { getPrivateKey, HttpError } from './security';
import { base64, hmacBytes } from './crypto';
import { consumeRateLimit } from './dealership';
import type { DealerEnvironment, SqlDatabase } from './types';

export function database(): SqlDatabase {
  if (!env.DB) throw new HttpError(503, 'The dealership database is being configured. Please try again shortly.', 'database_unavailable');
  return env.DB as unknown as SqlDatabase;
}

export function environment(): DealerEnvironment {
  return { DB: database(), PRIVATE_API_KEY: env.PRIVATE_API_KEY, SITE_URL: env.SITE_URL,
    FLW_SECRET_KEY: env.FLW_SECRET_KEY, FLW_WEBHOOK_SECRET: env.FLW_WEBHOOK_SECRET, FLW_WEBHOOK_SIGNATURE_MODE: env.FLW_WEBHOOK_SIGNATURE_MODE };
}

export function mediaBucket(): R2Bucket {
  if (!env.BUCKET) throw new HttpError(503, 'Photo uploads are being configured. Please try again shortly.', 'media_unavailable');
  return env.BUCKET;
}

export async function limitRequest(request: Request, scope: string, limit: number, seconds: number): Promise<void> {
  // Cloudflare supplies this header. No raw IP address is written to the database.
  const network = (request.headers.get('cf-connecting-ip') || 'unknown-network').slice(0,128);
  const digest = base64(await hmacBytes(getPrivateKey(), `velocity:rate-limit:v1:${scope}:${network}`));
  await consumeRateLimit(database(), `${scope}:${digest}`, limit, seconds);
}
