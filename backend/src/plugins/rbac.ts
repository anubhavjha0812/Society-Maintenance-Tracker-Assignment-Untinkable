import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../modules/auth/auth.js";
import { Errors } from "../lib/errors.js";

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: "resident" | "society_admin" | "super_admin";
  societyId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser: AuthedUser | null;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: AuthedUser["role"][]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Populates request.currentUser from the Better-Auth session cookie/token
 * on every request (cheap: no-op if there's no session), then exposes
 * requireAuth / requireRole as preHandler hooks. society_id always comes
 * from this resolved session — routes never trust a client-supplied
 * society_id, which is what makes cross-tenant leakage impossible by
 * construction (see spec's Multi-Tenancy section).
 */
export default fp(async function rbacPlugin(app: FastifyInstance) {
  app.decorateRequest("currentUser", null);

  app.addHook("onRequest", async (request) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }

    const session = await auth.api.getSession({ headers });
    if (session?.user) {
      const user = session.user as unknown as {
        id: string;
        email: string;
        name: string;
        role: AuthedUser["role"];
        societyId: string;
      };
      request.currentUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        societyId: user.societyId,
      };
    }
  });

  app.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      throw Errors.unauthorized();
    }
  });

  app.decorate(
    "requireRole",
    (...roles: AuthedUser["role"][]) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.currentUser) {
          throw Errors.unauthorized();
        }
        if (!roles.includes(request.currentUser.role)) {
          throw Errors.forbidden("Your role cannot access this resource");
        }
      },
  );
});
