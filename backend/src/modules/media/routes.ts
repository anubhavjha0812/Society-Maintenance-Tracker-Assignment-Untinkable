import type { FastifyInstance } from "fastify";
import { presignSchema, confirmSchema } from "./schema.js";
import {
  presignComplaintPhotoUpload,
  isAllowedContentType,
  MAX_UPLOAD_BYTES,
} from "../../lib/storage.js";
import { Errors } from "../../lib/errors.js";

/**
 * Two-step flow per spec: POST /media/presign returns a pre-signed R2 URL;
 * the client PUTs the file bytes straight to R2, then calls the confirm
 * endpoint so we record the ComplaintPhoto row only once the upload is
 * known to have happened. The presigned PUT URL only binds Content-Type
 * (R2/S3 checks that against the signature), not the byte size — so
 * confirm re-validates both content-type and size itself rather than
 * trusting a client that skips presign and calls confirm directly.
 */
export default async function mediaRoutes(app: FastifyInstance) {
  app.post(
    "/media/presign",
    { schema: presignSchema, preHandler: [app.requireRole("resident")] },
    async (request) => {
      const user = request.currentUser!;
      const { complaintId, contentType, sizeBytes } = request.body as {
        complaintId: string;
        contentType: string;
        sizeBytes: number;
      };

      if (!isAllowedContentType(contentType)) {
        throw Errors.badRequest("Unsupported content type");
      }
      if (sizeBytes > MAX_UPLOAD_BYTES) {
        throw Errors.badRequest(`File exceeds max size of ${MAX_UPLOAD_BYTES} bytes`);
      }

      const complaint = await app.prisma.complaint.findFirst({
        where: { id: complaintId, societyId: user.societyId, residentId: user.id },
      });
      if (!complaint) throw Errors.notFound("Complaint not found");

      return presignComplaintPhotoUpload({
        societyId: user.societyId,
        complaintId,
        contentType,
      });
    },
  );

  app.post(
    "/media/confirm",
    { schema: confirmSchema, preHandler: [app.requireRole("resident")] },
    async (request, reply) => {
      const user = request.currentUser!;
      const { complaintId, objectStorageKey, contentType, sizeBytes } = request.body as {
        complaintId: string;
        objectStorageKey: string;
        contentType: string;
        sizeBytes: number;
      };

      const complaint = await app.prisma.complaint.findFirst({
        where: { id: complaintId, societyId: user.societyId, residentId: user.id },
      });
      if (!complaint) throw Errors.notFound("Complaint not found");
      if (!objectStorageKey.startsWith(`societies/${user.societyId}/complaints/${complaintId}/`)) {
        throw Errors.badRequest("objectStorageKey does not match this complaint");
      }

      const photo = await app.prisma.complaintPhoto.create({
        data: { complaintId, objectStorageKey, contentType, sizeBytes },
      });
      reply.status(201).send(photo);
    },
  );
}
