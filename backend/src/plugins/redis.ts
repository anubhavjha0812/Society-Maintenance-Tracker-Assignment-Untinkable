import fp from "fastify-plugin";
import { Redis } from "ioredis";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: InstanceType<typeof Redis>;
  }
}

export default fp(async function redisPlugin(app: FastifyInstance) {
  const redis = new Redis(env.UPSTASH_REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  // ioredis's EventEmitter throws (crashing the whole process) on an
  // 'error' event with no listener attached — a connection blip shouldn't
  // take the whole API down, so this just logs and lets ioredis's own
  // reconnect logic keep trying.
  redis.on("error", (err) => {
    app.log.error({ err }, "Redis connection error");
  });

  app.decorate("redis", redis);
  app.addHook("onClose", async (instance) => {
    instance.redis.disconnect();
  });
});
