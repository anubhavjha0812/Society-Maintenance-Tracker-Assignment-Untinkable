import { Prisma } from "@prisma/client";

/**
 * Notices sort important-first, then newest-first — both DESC, so unlike
 * the admin complaint list (see complaints/adminSort.ts) no sign-flipping
 * is needed: a plain row-value `<` on (is_important, created_at, id)
 * already means "comes later in this order" for every column.
 */
export interface NoticeCursor {
  isImportant: boolean;
  createdAt: string;
  id: string;
}

export function encodeNoticeCursor(c: NoticeCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeNoticeCursor(raw: string | undefined): NoticeCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed?.isImportant === "boolean" &&
      typeof parsed?.createdAt === "string" &&
      typeof parsed?.id === "string"
    ) {
      return parsed as NoticeCursor;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildNoticeListQuery(args: {
  societyId: string;
  cursor: NoticeCursor | null;
  limit: number;
}) {
  const conditions: Prisma.Sql[] = [Prisma.sql`society_id = ${args.societyId}`];

  if (args.cursor) {
    conditions.push(Prisma.sql`
      (
        (CASE WHEN is_important THEN 1 ELSE 0 END),
        created_at,
        id
      ) < (
        ${args.cursor.isImportant ? 1 : 0},
        ${new Date(args.cursor.createdAt)},
        ${args.cursor.id}
      )
    `);
  }

  const where = Prisma.join(conditions, " AND ");

  return Prisma.sql`
    SELECT id, society_id, title, body, is_important, posted_by, created_at
    FROM notices
    WHERE ${where}
    ORDER BY is_important DESC, created_at DESC, id DESC
    LIMIT ${args.limit + 1}
  `;
}
