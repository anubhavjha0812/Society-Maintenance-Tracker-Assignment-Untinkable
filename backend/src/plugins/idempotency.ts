import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { withRedisTimeout } from "../lib/redisTimeout.js";

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24h, matches spec's "idempotency-key support"
const LOCK_TTL_SECONDS = 30; // long enough for one request/DB round trip, short enough not to wedge a retry for long if the server crashes mid-request
const PENDING_MARKER = "__pending__";

/**
 * Header-based idempotency for POST/PATCH. Client sends `Idempotency-Key`;
 * the first request to claim a key (atomically, via Redis SET NX) runs
 * normally and its 2xx response is cached under that key. A replay with
 * the same key returns the cached response instead of re-running the
 * handler (e.g. a resident double-submitting a complaint on flaky mobile
 * network).
 *
 * The claim is atomic specifically to close a race two concurrent
 * requests with the same key would otherwise hit: a plain GET-then-later-
 * SET (as an earlier version of this file did) lets both requests miss
 * the cache and both run the handler, defeating the whole point. SET NX
 * makes only one of them win the claim; the loser either replays the
 * (by-then-ready) cached response or gets a 409 telling it to retry
 * shortly if the winner is still mid-flight.
 *
 * The cache key is scoped by actor id (not just society) and by the
 * *resolved* request URL (not the route pattern) — request.routeOptions.url
 * is the same literal string ("/complaints/:id/status") for every complaint
 * id, so keying on it alone would let a client-reused key collide across
 * different users or different resources on the same route.
 *
 * Every Redis call here is wrapped in a short timeout. ioredis is
 * configured with maxRetriesPerRequest: null (required for BullMQ
 * elsewhere), which means a command issued against an unreachable Redis
 * queues forever rather than rejecting — confirmed by testing this
 * against a real outage, where it hung every POST/PATCH request that
 * carried an Idempotency-Key indefinitely. Idempotency is a reliability
 * nice-to-have, not something worth taking the whole write path down
 * for, so a timeout here degrades to "run the request without
 * idempotency protection" instead.
 */
export default fp(async function idempotencyPlugin(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST" && request.method !== "PATCH") return;

    const key = request.headers["idempotency-key"];
    if (!key || typeof key !== "string") return;

    const actor = request.currentUser?.id ?? "anon";
    const cacheKey = `idempotency:${actor}:${request.url}:${key}`;

    let claimed: string | null;
    try {
      claimed = await withRedisTimeout(
        app.redis.set(cacheKey, PENDING_MARKER, "EX", LOCK_TTL_SECONDS, "NX"),
      );
    } catch {
      request.log.warn("Redis unavailable/slow for idempotency check — proceeding without it");
      return;
    }

    if (claimed === "OK") {
      (request as unknown as { idempotencyCacheKey?: string }).idempotencyCacheKey = cacheKey;
      return;
    }

    // Someone else already claimed this key — either their response is
    // cached (replay it) or they're still mid-flight (ask for a retry).
    let existing: string | null;
    try {
      existing = await withRedisTimeout(app.redis.get(cacheKey));
    } catch {
      request.log.warn("Redis unavailable/slow for idempotency replay lookup — proceeding without it");
      return;
    }

    if (existing && existing !== PENDING_MARKER) {
      const { status, body } = JSON.parse(existing) as { status: number; body: unknown };
      reply.status(status).send(body);
      return reply;
    }

    reply.status(409).send({
      error: "request_in_progress",
      message: "A request with this Idempotency-Key is already being processed. Retry shortly.",
    });
    return reply;
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const cacheKey = (request as unknown as { idempotencyCacheKey?: string }).idempotencyCacheKey;
    if (!cacheKey) return payload;

    try {
      if (reply.statusCode >= 200 && reply.statusCode < 300) {
        const body = typeof payload === "string" ? safeParse(payload) : payload;
        await withRedisTimeout(
          app.redis.set(
            cacheKey,
            JSON.stringify({ status: reply.statusCode, body }),
            "EX",
            IDEMPOTENCY_TTL_SECONDS,
          ),
        );
      } else {
        // The handler failed (validation error, thrown AppError, etc.) —
        // release the claim instead of caching a failure or leaving the
        // pending marker to block retries for the full lock TTL.
        await withRedisTimeout(app.redis.del(cacheKey));
      }
    } catch {
      request.log.warn("Redis unavailable/slow while finalizing idempotency record");
    }
    return payload;
  });
});

function safeParse(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}
