import type { FastifySchema } from "fastify";

export const presignSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["complaintId", "contentType", "sizeBytes"],
    additionalProperties: false,
    properties: {
      complaintId: { type: "string" },
      contentType: { type: "string" },
      sizeBytes: { type: "integer", minimum: 1 },
    },
  },
};

export const confirmSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["complaintId", "objectStorageKey", "contentType", "sizeBytes"],
    additionalProperties: false,
    properties: {
      complaintId: { type: "string" },
      objectStorageKey: { type: "string" },
      contentType: { type: "string" },
      sizeBytes: { type: "integer", minimum: 1 },
    },
  },
};
