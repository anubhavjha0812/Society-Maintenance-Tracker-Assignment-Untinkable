import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";

const prisma = new PrismaClient();

/**
 * A resident signs up with { email, password, name, flatNumber, societyId },
 * picking societyId from GET /societies (routes.ts). We never let the
 * client set role directly — this hook unconditionally overwrites it below.
 * societyId itself is client-chosen (self-service society selection, one of
 * the two MVP-acceptable flows per the spec — no invite code), so the only
 * server-side check is that the id actually corresponds to a real society.
 * The one seeded admin per society is created directly by the seed script,
 * not through this public endpoint.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Better-Auth defaults to serving itself at /api/auth; this app mounts
  // it at /api/v1/auth (routes.ts's bridge forwards every request under
  // that prefix into auth.handler()), so basePath has to match or every
  // request 404s inside Better-Auth's own internal router before it ever
  // reaches an endpoint.
  basePath: "/api/v1/auth",
  trustedOrigins: [env.FRONTEND_URL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      // input:true here does NOT mean the client is trusted to set these
      // — the before hook below unconditionally overwrites both on every
      // /sign-up/email call, discarding whatever the client sent. That
      // overwrite is what actually enforces "the client can never set
      // society_id or role" (per the spec's multi-tenancy rule), not the
      // schema. input:false looked like the more locked-down choice, but
      // it makes Better-Auth's own endpoint schema reject the field
      // outright — including when this app's own hook is the one setting
      // it — so registration itself becomes unreachable. input:true is
      // required for the hook's injected value to reach the DB write.
      role: { type: "string", input: true, required: false, defaultValue: "resident" },
      societyId: { type: "string", input: true, required: false },
      flatNumber: { type: "string", input: true, required: false },
      phone: { type: "string", input: true, required: false },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Making role/societyId input:true (see the comment above) so this
      // hook can inject them on sign-up also means Better-Auth's own
      // built-in /update-user endpoint would otherwise accept them
      // straight from an authenticated caller's request body — letting
      // any signed-in resident PATCH their own role to society_admin or
      // hop to a different society_id entirely. Every path except the
      // one sign-up flow this hook controls must reject those two keys
      // outright.
      if (ctx.path !== "/sign-up/email") {
        const body = ctx.body as Record<string, unknown> | undefined;
        if (body && ("role" in body || "societyId" in body)) {
          throw new APIError("FORBIDDEN", {
            message: "role and societyId cannot be set through this endpoint",
          });
        }
        return;
      }

      // Thrown as better-call's own APIError, not this app's AppError —
      // better-call's router only special-cases APIError instances when
      // deciding how to turn a hook's thrown error into a response
      // (anything else becomes an opaque 500 with no body), so an
      // AppError here would silently swallow this message.
      const body = ctx.body as { societyId?: string } | undefined;
      const societyId = body?.societyId?.trim();
      if (!societyId) {
        throw new APIError("BAD_REQUEST", { message: "societyId is required to register" });
      }

      const society = await prisma.society.findUnique({
        where: { id: societyId },
      });
      if (!society) {
        throw new APIError("BAD_REQUEST", { message: "Unknown society" });
      }

      return {
        context: {
          ...ctx,
          body: {
            ...ctx.body,
            societyId: society.id,
            role: "resident",
          },
        },
      };
    }),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once/day of activity
  },
  rateLimit: {
    enabled: true,
  },
});

export type AuthSession = typeof auth.$Infer.Session;
