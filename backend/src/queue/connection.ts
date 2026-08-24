import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * BullMQ needs its own Redis connection separate from the Fastify
 * request-cache one (app.redis) — it manages blocking commands and its
 * own reconnect lifecycle, and BullMQ requires maxRetriesPerRequest: null.
 */
export function createQueueConnection() {
  return new Redis(env.UPSTASH_REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}
