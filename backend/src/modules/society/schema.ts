import type { FastifySchema } from "fastify";

export const listResidentsSchema: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      cursor: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
};

export const updateSettingsSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["overdueThresholdDays"],
    additionalProperties: false,
    properties: {
      overdueThresholdDays: { type: "integer", minimum: 1, maximum: 90 },
    },
  },
};
