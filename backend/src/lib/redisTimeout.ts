const DEFAULT_TIMEOUT_MS = 1500;

/**
 * ioredis is configured everywhere in this app with
 * maxRetriesPerRequest: null (required for BullMQ) — which means a
 * command issued against an unreachable Redis queues forever instead of
 * rejecting. Confirmed by testing against a real outage: without this,
 * every Redis-touching request path (idempotency checks, the dashboard
 * cache) hangs indefinitely rather than failing fast. Wrap any
 * fire-and-forget-able Redis call in this so a Redis outage degrades
 * (skip the cache/idempotency check, fall through to doing the real
 * work) instead of hanging the request.
 */
export function withRedisTimeout<T>(promise: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Redis call timed out")), ms)),
  ]);
}
