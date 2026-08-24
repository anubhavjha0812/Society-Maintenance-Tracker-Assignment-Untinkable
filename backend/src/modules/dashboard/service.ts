import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { withRedisTimeout } from "../../lib/redisTimeout.js";

const CACHE_TTL_SECONDS = 60;

export interface DashboardSummary {
  totalOpen: number;
  totalInProgress: number;
  totalResolved: number;
  totalOverdue: number;
  byCategory: { category: string; count: number }[];
}

function cacheKey(societyId: string) {
  return `dashboard:summary:${societyId}`;
}

/**
 * Cached for 60s per society (spec: "cache response for ~60 seconds via
 * Upstash Redis rather than recomputing on every request"). A cache miss
 * runs the aggregate queries and repopulates; nothing invalidates it
 * early — a stale-for-up-to-60s dashboard is an accepted MVP tradeoff.
 */
export async function getDashboardSummary(
  prisma: PrismaClient,
  redis: Redis,
  societyId: string,
): Promise<DashboardSummary> {
  try {
    const cached = await withRedisTimeout(redis.get(cacheKey(societyId)));
    if (cached) {
      return JSON.parse(cached) as DashboardSummary;
    }
  } catch {
    // Redis unavailable/slow — fall through and compute fresh rather
    // than hang the request (see lib/redisTimeout.ts).
  }

  const [statusCounts, overdueCount, categoryCounts] = await Promise.all([
    prisma.complaint.groupBy({
      by: ["currentStatus"],
      where: { societyId },
      _count: { _all: true },
    }),
    prisma.complaint.count({ where: { societyId, isOverdue: true } }),
    prisma.complaint.groupBy({
      by: ["category"],
      where: { societyId },
      _count: { _all: true },
    }),
  ]);

  const byStatus = Object.fromEntries(
    statusCounts.map((row) => [row.currentStatus, row._count._all]),
  );

  const summary: DashboardSummary = {
    totalOpen: byStatus["Open"] ?? 0,
    totalInProgress: byStatus["InProgress"] ?? 0,
    totalResolved: byStatus["Resolved"] ?? 0,
    totalOverdue: overdueCount,
    byCategory: categoryCounts.map((row) => ({ category: row.category, count: row._count._all })),
  };

  try {
    await withRedisTimeout(redis.set(cacheKey(societyId), JSON.stringify(summary), "EX", CACHE_TTL_SECONDS));
  } catch {
    // Not fatal — the summary was already computed; it just won't be
    // cached for the next request until Redis is reachable again.
  }
  return summary;
}
