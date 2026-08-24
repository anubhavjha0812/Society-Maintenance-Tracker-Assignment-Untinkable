import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24h, matches spec's "idempotency-key support"

/**
 * Header-based idempotency for POST/PATCH. Client sends `Idempotency-Key`;
 * on first sight we let the request through and, once it completes with a
 * 2xx, cache { status, body } under that key. A replay with the same key
 * returns the cached response instead of re-running the handler (e.g. a
 * resident double-submitting a complaint on flaky mobile network).
 */
export default fp(async function idempotencyPlugin(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST" && request.method !== "PATCH") return;

    const key = request.headers["idempotency-key"];
    if (!key || typeof key !== "string") return;

    const cacheKey = `idempotency:${request.currentUser?.societyId ?? "anon"}:${request.routeOptions.url}:${key}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) {
      const { status, body } = JSON.parse(cached) as { status: number; body: unknown };
      reply.status(status).send(body);
      return reply;
    }

    (request as unknown as { idempotencyCacheKey?: string }).idempotencyCacheKey = cacheKey;
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const cacheKey = (request as unknown as { idempotencyCacheKey?: string }).idempotencyCacheKey;
    if (!cacheKey) return payload;
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      const body = typeof payload === "string" ? safeParse(payload) : payload;
      await app.redis.set(
        cacheKey,
        JSON.stringify({ status: reply.statusCode, body }),
        "EX",
        IDEMPOTENCY_TTL_SECONDS,
      );
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
