import type { FastifyInstance } from "fastify";
import {
  createComplaintSchema,
  listMineSchema,
  listAdminSchema,
  updatePrioritySchema,
  updateStatusSchema,
  historySchema,
} from "./schema.js";
import {
  createComplaint,
  listMyComplaints,
  listAdminComplaints,
  updatePriority,
  updateComplaintStatus,
  getComplaintHistory,
} from "./service.js";
import { decodeCursor, clampLimit } from "../../lib/pagination.js";
import { decodeAdminCursor } from "./adminSort.js";
import { Errors } from "../../lib/errors.js";
import type { Priority, ComplaintStatus } from "@prisma/client";

export default async function complaintsRoutes(app: FastifyInstance) {
  app.post(
    "/complaints",
    { schema: createComplaintSchema, preHandler: [app.requireRole("resident")] },
    async (request, reply) => {
      const user = request.currentUser!;
      const body = request.body as { category: string; description: string; priority?: Priority };
      const complaint = await createComplaint(app.prisma, {
        societyId: user.societyId,
        residentId: user.id,
        category: body.category,
        description: body.description,
        priority: body.priority,
      });
      reply.status(201).send(complaint);
    },
  );

  app.get(
    "/complaints/mine",
    { schema: listMineSchema, preHandler: [app.requireRole("resident")] },
    async (request) => {
      const user = request.currentUser!;
      const query = request.query as { cursor?: string; limit?: number };
      return listMyComplaints(app.prisma, {
        societyId: user.societyId,
        residentId: user.id,
        cursor: decodeCursor(query.cursor),
        limit: clampLimit(query.limit),
      });
    },
  );

  app.get(
    "/complaints",
    { schema: listAdminSchema, preHandler: [app.requireRole("society_admin", "super_admin")] },
    async (request) => {
      const user = request.currentUser!;
      const query = request.query as {
        cursor?: string;
        limit?: number;
        category?: string;
        status?: ComplaintStatus;
        priority?: Priority;
        from?: string;
        to?: string;
      };
      return listAdminComplaints(app.prisma, {
        societyId: user.societyId,
        category: query.category,
        status: query.status,
        priority: query.priority,
        from: query.from,
        to: query.to,
        cursor: decodeAdminCursor(query.cursor),
        limit: clampLimit(query.limit),
      });
    },
  );

  app.patch(
    "/complaints/:id/priority",
    { schema: updatePrioritySchema, preHandler: [app.requireRole("society_admin", "super_admin")] },
    async (request) => {
      const user = request.currentUser!;
      const { id } = request.params as { id: string };
      const { priority } = request.body as { priority: Priority };
      return updatePriority(app.prisma, { id, societyId: user.societyId, priority });
    },
  );

  app.patch(
    "/complaints/:id/status",
    { schema: updateStatusSchema, preHandler: [app.requireRole("society_admin", "super_admin")] },
    async (request) => {
      const user = request.currentUser!;
      const { id } = request.params as { id: string };
      const { status, note } = request.body as {
        status: "InProgress" | "Resolved" | "Reopened";
        note?: string;
      };
      return updateComplaintStatus(app.prisma, {
        id,
        societyId: user.societyId,
        actorId: user.id,
        status,
        note,
      });
    },
  );

  app.get(
    "/complaints/:id/history",
    { schema: historySchema, preHandler: [app.requireAuth] },
    async (request) => {
      const user = request.currentUser!;
      const { id } = request.params as { id: string };
      // Residents may only view history for their own complaints; admins
      // may view any complaint in their society. Enforced in the service
      // layer's tenant-scoped lookup plus this extra ownership check.
      if (user.role === "resident") {
        const complaint = await app.prisma.complaint.findFirst({
          where: { id, societyId: user.societyId, residentId: user.id },
        });
        if (!complaint) {
          throw Errors.notFound("Complaint not found");
        }
      }
      return getComplaintHistory(app.prisma, { id, societyId: user.societyId });
    },
  );
}
