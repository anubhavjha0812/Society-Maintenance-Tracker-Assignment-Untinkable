import type { PrismaClient, Priority, ComplaintStatus, HistoryStatus } from "@prisma/client";
import { Errors } from "../../lib/errors.js";
import { afterCursorWhere, buildPage, type Cursor } from "../../lib/pagination.js";
import {
  buildAdminComplaintQuery,
  encodeAdminCursor,
  type AdminComplaintFilters,
} from "./adminSort.js";
import { enqueueStatusChangeNotification } from "../../queue/queues.js";

interface CreateComplaintInput {
  societyId: string;
  residentId: string;
  category: string;
  description: string;
  priority?: Priority;
}

export async function createComplaint(prisma: PrismaClient, input: CreateComplaintInput) {
  return prisma.complaint.create({
    data: {
      societyId: input.societyId,
      residentId: input.residentId,
      category: input.category,
      description: input.description,
      priority: input.priority ?? "Medium",
    },
  });
}

export async function listMyComplaints(
  prisma: PrismaClient,
  args: { societyId: string; residentId: string; cursor: Cursor | null; limit: number },
) {
  const rows = await prisma.complaint.findMany({
    where: {
      societyId: args.societyId,
      residentId: args.residentId,
      ...afterCursorWhere(args.cursor),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limit + 1,
  });
  return buildPage(rows, args.limit);
}

interface RawAdminRow {
  id: string;
  society_id: string;
  resident_id: string;
  category: string;
  description: string;
  priority: Priority;
  current_status: ComplaintStatus;
  is_overdue: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function listAdminComplaints(prisma: PrismaClient, filters: AdminComplaintFilters) {
  const query = buildAdminComplaintQuery(filters);
  const rows = await prisma.$queryRaw<RawAdminRow[]>(query);

  const hasMore = rows.length > filters.limit;
  const page = hasMore ? rows.slice(0, filters.limit) : rows;
  const last = page[page.length - 1];

  const nextCursor: string | null =
    hasMore && last
      ? encodeAdminCursor({
          isOverdue: last.is_overdue,
          priority: last.priority,
          createdAt: last.created_at.toISOString(),
          id: last.id,
        })
      : null;

  return {
    items: page.map((row) => ({
      id: row.id,
      societyId: row.society_id,
      residentId: row.resident_id,
      category: row.category,
      description: row.description,
      priority: row.priority,
      currentStatus: row.current_status,
      isOverdue: row.is_overdue,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    nextCursor,
  };
}

async function getComplaintScoped(prisma: PrismaClient, id: string, societyId: string) {
  const complaint = await prisma.complaint.findFirst({ where: { id, societyId } });
  if (!complaint) throw Errors.notFound("Complaint not found");
  return complaint;
}

export async function updatePriority(
  prisma: PrismaClient,
  args: { id: string; societyId: string; priority: Priority },
) {
  await getComplaintScoped(prisma, args.id, args.societyId);
  return prisma.complaint.update({
    where: { id: args.id },
    data: { priority: args.priority },
  });
}

const FORWARD_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  Open: ["InProgress", "Resolved"],
  InProgress: ["Resolved"],
  Resolved: [],
};

/**
 * Status changes only ever move a complaint forward (Open -> InProgress ->
 * Resolved) or, once Resolved, back to Open via the explicit Reopen action
 * — never a silent edit. Every transition appends a ComplaintStatusHistory
 * row (append-only; this function never updates/deletes existing history
 * rows) and mirrors the result onto Complaint.current_status as a
 * denormalized read model.
 */
export async function updateComplaintStatus(
  prisma: PrismaClient,
  args: {
    id: string;
    societyId: string;
    actorId: string;
    status: "InProgress" | "Resolved" | "Reopened";
    note?: string;
  },
) {
  const complaint = await getComplaintScoped(prisma, args.id, args.societyId);

  let nextCurrentStatus: ComplaintStatus;
  let historyStatus: HistoryStatus;

  if (args.status === "Reopened") {
    if (complaint.currentStatus !== "Resolved") {
      throw Errors.conflict("Only a Resolved complaint can be reopened");
    }
    nextCurrentStatus = "Open";
    historyStatus = "Reopened";
  } else {
    const allowed = FORWARD_TRANSITIONS[complaint.currentStatus];
    if (!allowed.includes(args.status)) {
      throw Errors.conflict(
        `Cannot move complaint from ${complaint.currentStatus} to ${args.status}`,
      );
    }
    nextCurrentStatus = args.status;
    historyStatus = args.status;
  }

  // Any transition clears is_overdue — the sweep job (queue/workers
  // overdueSweep.worker.ts) is solely responsible for setting it back to
  // true, based on how long the complaint has sat in Open since this
  // update, once it next runs.
  const [historyRow, updated] = await prisma.$transaction([
    prisma.complaintStatusHistory.create({
      data: {
        complaintId: complaint.id,
        societyId: args.societyId,
        status: historyStatus,
        note: args.note,
        actorId: args.actorId,
      },
    }),
    prisma.complaint.update({
      where: { id: complaint.id },
      data: { currentStatus: nextCurrentStatus, isOverdue: false },
    }),
  ]);

  await enqueueStatusChangeNotification({
    complaintId: complaint.id,
    societyId: args.societyId,
    residentId: complaint.residentId,
    newStatus: nextCurrentStatus,
    historyId: historyRow.id,
  });

  return updated;
}

export async function getComplaintHistory(
  prisma: PrismaClient,
  args: { id: string; societyId: string },
) {
  await getComplaintScoped(prisma, args.id, args.societyId);
  return prisma.complaintStatusHistory.findMany({
    where: { complaintId: args.id, societyId: args.societyId },
    orderBy: { timestamp: "asc" },
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
}
