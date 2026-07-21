interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window-ish limiter, per server process. Fine for a
 * single instance; swap for Redis (e.g. Upstash) before running multiple
 * serverless instances in production, since each instance would otherwise
 * track its own counts.
 */
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  // Outside production there's no reverse proxy setting x-forwarded-for, so
  // every caller would collapse into the same "unknown" bucket and rate
  // limiting would just break local dev/testing instead of deterring abuse.
  if (process.env.NODE_ENV !== "production") return true;

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
