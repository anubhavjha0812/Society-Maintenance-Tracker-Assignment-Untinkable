import type { FastifyInstance } from "fastify";
import { listResidentsSchema, updateSettingsSchema } from "./schema.js";
import { getSocietySettings, listResidents, updateOverdueThreshold } from "./service.js";
import { decodeCursor, clampLimit } from "../../lib/pagination.js";

export default async function societyRoutes(app: FastifyInstance) {
  app.get(
    "/society",
    { preHandler: [app.requireRole("society_admin", "super_admin")] },
    async (request) => {
      const user = request.currentUser!;
      return getSocietySettings(app.prisma, user.societyId);
    },
  );

  app.get(
    "/society/residents",
    { schema: listResidentsSchema, preHandler: [app.requireRole("society_admin", "super_admin")] },
    async (request) => {
      const user = request.currentUser!;
      const query = request.query as { cursor?: string; limit?: number };
      return listResidents(app.prisma, {
        societyId: user.societyId,
        cursor: decodeCursor(query.cursor),
        limit: clampLimit(query.limit),
      });
    },
  );

  app.patch(
    "/society/settings",
    { schema: updateSettingsSchema, preHandler: [app.requireRole("society_admin", "super_admin")] },
    async (request) => {
      const user = request.currentUser!;
      const body = request.body as { overdueThresholdDays: number };
      return updateOverdueThreshold(app.prisma, user.societyId, body.overdueThresholdDays);
    },
  );
}
