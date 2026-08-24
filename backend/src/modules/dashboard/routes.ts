import type { FastifyInstance } from "fastify";
import { getDashboardSummary } from "./service.js";

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get(
    "/dashboard/summary",
    { preHandler: [app.requireRole("society_admin", "super_admin")] },
    async (request) => {
      const user = request.currentUser!;
      return getDashboardSummary(app.prisma, app.redis, user.societyId);
    },
  );
}
