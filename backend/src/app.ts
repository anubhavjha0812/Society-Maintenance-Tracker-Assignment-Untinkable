import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import prismaPlugin from "./plugins/prisma.js";
import redisPlugin from "./plugins/redis.js";
import rbacPlugin from "./plugins/rbac.js";
import idempotencyPlugin from "./plugins/idempotency.js";
import authRoutes from "./modules/auth/routes.js";
import complaintsRoutes from "./modules/complaints/routes.js";
import noticesRoutes from "./modules/notices/routes.js";
import dashboardRoutes from "./modules/dashboard/routes.js";
import mediaRoutes from "./modules/media/routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
  });

  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(rbacPlugin);
  await app.register(idempotencyPlugin);

  // Rate limiting on auth is the spec's explicit minimum; applied here at
  // the global level scoped down via config on the auth routes below.
  await app.register(rateLimit, {
    global: false,
  });

  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }
    if (error.validation) {
      reply.status(400).send({ error: "validation_error", message: error.message });
      return;
    }
    request.log.error(error);
    reply.status(500).send({ error: "internal_error", message: "Something went wrong" });
  });

  app.get("/healthz", async () => ({ ok: true }));

  await app.register(
    async (instance) => {
      await instance.register(rateLimit, {
        max: 20,
        timeWindow: "1 minute",
      });
      await instance.register(authRoutes);
    },
    { prefix: "/api/v1" },
  );

  await app.register(
    async (instance) => {
      await instance.register(complaintsRoutes);
      await instance.register(noticesRoutes);
      await instance.register(dashboardRoutes);
      await instance.register(mediaRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
