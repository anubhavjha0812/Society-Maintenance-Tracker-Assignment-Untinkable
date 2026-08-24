import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * BullMQ needs its own Redis connection separate from the Fastify
 * request-cache one (app.redis) — it manages blocking commands and its
 * own reconnect lifecycle, and BullMQ requires maxRetriesPerRequest: null.
 */
export function createQueueConnection() {
  const connection = new Redis(env.UPSTASH_REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  // Same reasoning as plugins/redis.ts: an unlistened 'error' event on an
  // ioredis client crashes the whole process, which would take down the
  // entire API (this connection is shared by the in-process BullMQ
  // worker) over what should just be a retried connection blip.
  connection.on("error", (err) => {
    console.error("[queue] Redis connection error:", err.message);
  });

  return connection;
}
