declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    STAFF_EMAILS?: string;
    PRIVATE_API_KEY?: string;
    SITE_URL?: string;
    FLW_SECRET_KEY?: string;
    FLW_WEBHOOK_SECRET?: string;
    FLW_WEBHOOK_SIGNATURE_MODE?: string;
  }
}
