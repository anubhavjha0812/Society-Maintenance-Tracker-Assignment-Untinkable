import type { FastifySchema } from "fastify";

export const createComplaintSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["category", "description"],
    additionalProperties: false,
    properties: {
      category: { type: "string", minLength: 1, maxLength: 80 },
      description: { type: "string", minLength: 1, maxLength: 4000 },
      priority: { type: "string", enum: ["Low", "Medium", "High"] },
    },
  },
};

export const listMineSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      cursor: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
};

export const listAdminSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      cursor: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
      category: { type: "string" },
      status: { type: "string", enum: ["Open", "InProgress", "Resolved"] },
      priority: { type: "string", enum: ["Low", "Medium", "High"] },
      from: { type: "string", format: "date-time" },
      to: { type: "string", format: "date-time" },
    },
  },
};

export const updatePrioritySchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["priority"],
    additionalProperties: false,
    properties: {
      priority: { type: "string", enum: ["Low", "Medium", "High"] },
    },
  },
};

export const updateStatusSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["status"],
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: ["InProgress", "Resolved", "Reopened"] },
      note: { type: "string", maxLength: 1000 },
    },
  },
};

export const historySchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string" } },
  },
};
