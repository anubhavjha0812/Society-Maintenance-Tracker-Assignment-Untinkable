import type { PrismaClient } from "@prisma/client";
import { buildNoticeListQuery, encodeNoticeCursor, type NoticeCursor } from "./noticeSort.js";
import { enqueueNoticeFanout } from "../../queue/queues.js";

interface CreateNoticeInput {
  societyId: string;
  postedBy: string;
  title: string;
  body: string;
  isImportant: boolean;
}

export async function createNotice(prisma: PrismaClient, input: CreateNoticeInput) {
  const notice = await prisma.notice.create({ data: input });

  if (notice.isImportant) {
    // Fan out one job per resident onto the notification queue — never
    // loop and send emails synchronously in the request handler (spec).
    const residents = await prisma.user.findMany({
      where: { societyId: input.societyId, role: "resident" },
      select: { id: true },
    });
    await Promise.all(
      residents.map((resident) =>
        enqueueNoticeFanout({ noticeId: notice.id, societyId: input.societyId, residentId: resident.id }),
      ),
    );
  }

  return notice;
}

interface RawNoticeRow {
  id: string;
  society_id: string;
  title: string;
  body: string;
  is_important: boolean;
  posted_by: string;
  created_at: Date;
}

export async function listNotices(
  prisma: PrismaClient,
  args: { societyId: string; cursor: NoticeCursor | null; limit: number },
) {
  const rows = await prisma.$queryRaw<RawNoticeRow[]>(buildNoticeListQuery(args));

  const hasMore = rows.length > args.limit;
  const page = hasMore ? rows.slice(0, args.limit) : rows;
  const last = page[page.length - 1];

  const nextCursor =
    hasMore && last
      ? encodeNoticeCursor({
          isImportant: last.is_important,
          createdAt: last.created_at.toISOString(),
          id: last.id,
        })
      : null;

  return {
    items: page.map((row) => ({
      id: row.id,
      societyId: row.society_id,
      title: row.title,
      body: row.body,
      isImportant: row.is_important,
      postedBy: row.posted_by,
      createdAt: row.created_at,
    })),
    nextCursor,
  };
}
