import type { FastifySchema } from "fastify";

export const createNoticeSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["title", "body"],
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", minLength: 1, maxLength: 8000 },
      isImportant: { type: "boolean" },
    },
  },
};

export const listNoticesSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      cursor: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
};
