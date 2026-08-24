import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";
import { Errors } from "../../lib/errors.js";

const prisma = new PrismaClient();

/**
 * Every society is seeded with an invite code (see prisma/seed.ts). A
 * resident signs up with { email, password, name, flatNumber, inviteCode }.
 * We never let the client set society_id or role directly — the invite
 * code is the only lever, and it's resolved server-side in this hook.
 * The one seeded admin per society is created directly by the seed script,
 * not through this public endpoint.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.FRONTEND_URL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "resident" },
      societyId: { type: "string", input: false },
      flatNumber: { type: "string", input: true, required: false },
      phone: { type: "string", input: true, required: false },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const body = ctx.body as { inviteCode?: string } | undefined;
      const inviteCode = body?.inviteCode?.trim();
      if (!inviteCode) {
        throw Errors.badRequest("inviteCode is required to register");
      }

      const society = await prisma.society.findUnique({
        where: { inviteCode },
      });
      if (!society) {
        throw Errors.badRequest("Invalid invite code");
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
