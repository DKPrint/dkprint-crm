/**
 * In-memory rate limiter (fixed window per key).
 * Per Vercel instance, not global — acceptable for v1; Redis later if needed.
 */

type Bucket = { count: number; windowStart: number };

const store = new Map<string, Bucket>();

export type RateLimitOptions = {
  max: number;
  windowMs: number;
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/** Remove expired buckets (lazy prune on each check). */
function pruneExpired(now: number, windowMs: number): void {
  for (const [key, bucket] of store) {
    if (now - bucket.windowStart >= windowMs) {
      store.delete(key);
    }
  }
}

/** Fixed-window counter; returns ok or seconds until window resets. */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpired(now, opts.windowMs);

  const bucket = store.get(key);
  if (!bucket || now - bucket.windowStart >= opts.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (bucket.count >= opts.max) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.windowStart + opts.windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  bucket.count += 1;
  return { ok: true };
}

/** Reset store — tests only. */
export function resetRateLimitStoreForTests(): void {
  store.clear();
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getLoginRateLimitConfig(): RateLimitOptions {
  return {
    max: parsePositiveInt(process.env.RATE_LIMIT_LOGIN_MAX, 10),
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 900_000),
  };
}

export function getCatalogImportRateLimitConfig(): RateLimitOptions {
  return {
    max: parsePositiveInt(process.env.RATE_LIMIT_CATALOG_IMPORT_MAX, 5),
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_CATALOG_IMPORT_WINDOW_MS, 3_600_000),
  };
}
