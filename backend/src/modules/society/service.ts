import type { PrismaClient } from "@prisma/client";
import { Errors } from "../../lib/errors.js";
import { afterCursorWhere, buildPage, type Cursor } from "../../lib/pagination.js";

export interface Resident {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  flatNumber: string | null;
  createdAt: Date;
}

export async function listResidents(
  prisma: PrismaClient,
  args: { societyId: string; cursor: Cursor | null; limit: number },
) {
  const rows = await prisma.user.findMany({
    where: { societyId: args.societyId, role: "resident", ...afterCursorWhere(args.cursor) },
    select: { id: true, name: true, email: true, phone: true, flatNumber: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  });
  return buildPage<Resident>(rows, args.limit);
}

export interface SocietySettings {
  id: string;
  name: string;
  overdueThresholdDays: number;
}

export async function getSocietySettings(prisma: PrismaClient, societyId: string): Promise<SocietySettings> {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { id: true, name: true, overdueThresholdDays: true },
  });
  if (!society) throw Errors.notFound("Society not found");
  return society;
}

/**
 * The overdue-sweep worker reads overdue_threshold_days fresh on every run
 * (see overdueSweep.worker.ts) rather than caching it, so a change here
 * takes effect on the sweep's next tick — no cache to invalidate.
 */
export async function updateOverdueThreshold(
  prisma: PrismaClient,
  societyId: string,
  overdueThresholdDays: number,
): Promise<SocietySettings> {
  return prisma.society.update({
    where: { id: societyId },
    data: { overdueThresholdDays },
    select: { id: true, name: true, overdueThresholdDays: true },
  });
}
