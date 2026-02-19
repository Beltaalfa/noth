/**
 * In-memory rate limiter (sliding window per key).
 * Use for single-instance deployments. For multi-instance, use Redis (e.g. @upstash/ratelimit).
 */

const windowMs = 60 * 1000; // 1 minute
const maxPerWindow = 30; // e.g. 30 requests per minute per key

const store = new Map<string, { count: number; resetAt: number }>();

function prune() {
  const now = Date.now();
  for (const [key, v] of store.entries()) {
    if (v.resetAt < now) store.delete(key);
  }
}
setInterval(prune, 60 * 1000);

export function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.resetAt < now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { ok: true };
  }
  if (entry.count >= maxPerWindow) {
    return { ok: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
  }
  entry.count++;
  return { ok: true };
}

export function getRateLimitKey(identifier: string, prefix: string): string {
  return `${prefix}:${identifier}`;
}
