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

  app.decorate("redis", redis);
  app.addHook("onClose", async (instance) => {
    instance.redis.disconnect();
  });
});
