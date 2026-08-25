import "server-only";
import { headers } from "next/headers";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
/** Opportunistic cleanup trigger — this app runs as a single long-lived
 * Node process (not distributed serverless), so an in-memory Map is a
 * reasonable, dependency-free store; without ever pruning it, one entry per
 * distinct key would accumulate for the process's entire lifetime. */
const MAX_TRACKED_KEYS = 5000;

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Fixed-window rate limiter for public Server Actions (contact form,
 * newsletter signup, ...) — not a hard security boundary (resets on process
 * restart, and a distributed/multi-instance deployment would need a shared
 * store instead), just enough to blunt obvious spam/abuse scripts without
 * adding external infrastructure. Returns true if the call is allowed.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > MAX_TRACKED_KEYS) sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Best-effort client IP from the reverse proxy's forwarded headers — every
 * realistic Hostinger/production deployment sits behind one. Falls back to
 * a single shared bucket (not "unlimited") when neither header is present,
 * which only means unusually-configured environments share one rate-limit
 * window rather than getting none at all. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}
