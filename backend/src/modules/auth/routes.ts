import type { FastifyInstance } from "fastify";
import { auth } from "./auth.js";

/**
 * Better-Auth ships a Web-standard (fetch Request/Response) handler.
 * Fastify gives us the raw Node req/res, so this bridges the two: build a
 * Request from the incoming Fastify request, hand it to Better-Auth, then
 * copy the resulting Response back onto Fastify's reply. This is the
 * standard integration pattern for frameworks Better-Auth doesn't have a
 * first-party adapter for.
 */
export default async function authRoutes(app: FastifyInstance) {
  // Public — registration needs to list societies to pick from before the
  // visitor has an account, so this can't sit behind the RBAC middleware.
  app.get("/societies", async () => {
    const societies = await app.prisma.society.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { societies };
  });

  app.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    // Auth endpoints are auth's own concern; skip Fastify's default JSON
    // schema validation here and let Better-Auth validate its own bodies.
    handler: async (request, reply) => {
      const url = new URL(request.url, `${request.protocol}://${request.hostname}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === "string") headers.set(key, value);
        else if (Array.isArray(value)) headers.set(key, value.join(", "));
      }

      const init: RequestInit = {
        method: request.method,
        headers,
      };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = JSON.stringify(request.body ?? {});
      }

      const webRequest = new Request(url.toString(), init);
      const webResponse = await auth.handler(webRequest);

      reply.status(webResponse.status);
      webResponse.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      const text = await webResponse.text();
      reply.send(text);
    },
  });
}
