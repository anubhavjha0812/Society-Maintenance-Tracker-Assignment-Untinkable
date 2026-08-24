import type { FastifyInstance } from "fastify";
import { createNoticeSchema, listNoticesSchema } from "./schema.js";
import { createNotice, listNotices } from "./service.js";
import { decodeNoticeCursor } from "./noticeSort.js";
import { clampLimit } from "../../lib/pagination.js";

export default async function noticesRoutes(app: FastifyInstance) {
  app.post(
    "/notices",
    { schema: createNoticeSchema, preHandler: [app.requireRole("society_admin", "super_admin")] },
    async (request, reply) => {
      const user = request.currentUser!;
      const { title, body, isImportant } = request.body as {
        title: string;
        body: string;
        isImportant?: boolean;
      };
      const notice = await createNotice(app.prisma, {
        societyId: user.societyId,
        postedBy: user.id,
        title,
        body,
        isImportant: isImportant ?? false,
      });
      reply.status(201).send(notice);
    },
  );

  app.get(
    "/notices",
    { schema: listNoticesSchema, preHandler: [app.requireAuth] },
    async (request) => {
      const user = request.currentUser!;
      const query = request.query as { cursor?: string; limit?: number };
      return listNotices(app.prisma, {
        societyId: user.societyId,
        cursor: decodeNoticeCursor(query.cursor),
        limit: clampLimit(query.limit),
      });
    },
  );
}
