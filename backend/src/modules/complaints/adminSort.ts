import { Prisma } from "@prisma/client";

/**
 * The admin complaint list sorts on three columns at once (overdue desc,
 * priority desc, age asc) — see spec: "Overdue complaints sort to the top
 * of the admin list (overdue -> priority -> age)". Prisma Client's typed
 * `where`/`orderBy` API can express the ORDER BY fine, but it can't express
 * enum `<`/`>` comparisons needed for real keyset (cursor) pagination on a
 * compound key. That's done here with a parameterized `$queryRaw` (Prisma.sql
 * tagged template — safe interpolation, never string concatenation, so this
 * still honors the "parameterized queries only" security baseline).
 */

export interface AdminComplaintCursor {
  isOverdue: boolean;
  priority: "Low" | "Medium" | "High";
  createdAt: string;
  id: string;
}

const PRIORITY_RANK: Record<AdminComplaintCursor["priority"], number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

export function encodeAdminCursor(c: AdminComplaintCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeAdminCursor(raw: string | undefined): AdminComplaintCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed?.isOverdue === "boolean" &&
      typeof parsed?.priority === "string" &&
      typeof parsed?.createdAt === "string" &&
      typeof parsed?.id === "string"
    ) {
      return parsed as AdminComplaintCursor;
    }
    return null;
  } catch {
    return null;
  }
}

export interface AdminComplaintFilters {
  societyId: string;
  category?: string;
  status?: "Open" | "InProgress" | "Resolved";
  priority?: "Low" | "Medium" | "High";
  from?: string;
  to?: string;
  search?: string;
  cursor: AdminComplaintCursor | null;
  limit: number;
}

/**
 * Row-value comparison encodes "strictly after `cursor` in
 * (is_overdue DESC, priority_rank DESC, created_at ASC, id DESC) order".
 * A plain row `<` on (a, b, c, d) means "a1<a2, or a1=a2 and b1<b2, ..." —
 * that only lines up with "comes later in the desired order" when every
 * column in the tuple is itself sorted DESC (smaller = later). is_overdue
 * and priority_rank already are; created_at is ASC, so its epoch is
 * negated to flip it into the same DESC-shaped comparison; id is used only
 * as a tiebreak so it's sorted DESC too (arbitrary but consistent — it
 * doesn't matter which direction, only that ORDER BY and the cursor
 * comparison agree) so it needs no transform.
 */
export function buildAdminComplaintQuery(filters: AdminComplaintFilters) {
  const { societyId, category, status, priority, from, to, search, cursor, limit } = filters;

  const conditions: Prisma.Sql[] = [Prisma.sql`society_id = ${societyId}`];
  if (category) conditions.push(Prisma.sql`category = ${category}`);
  if (status) conditions.push(Prisma.sql`current_status = ${status}::"ComplaintStatus"`);
  if (priority) conditions.push(Prisma.sql`priority = ${priority}::"Priority"`);
  if (from) conditions.push(Prisma.sql`created_at >= ${new Date(from)}`);
  if (to) conditions.push(Prisma.sql`created_at <= ${new Date(to)}`);
  if (search) conditions.push(Prisma.sql`(category ILIKE ${`%${search}%`} OR description ILIKE ${`%${search}%`})`);

  if (cursor) {
    const rank = PRIORITY_RANK[cursor.priority];
    conditions.push(Prisma.sql`
      (
        (CASE WHEN is_overdue THEN 1 ELSE 0 END),
        (CASE priority WHEN 'Low' THEN 0 WHEN 'Medium' THEN 1 WHEN 'High' THEN 2 END),
        (extract(epoch from created_at) * -1),
        id
      ) < (
        ${cursor.isOverdue ? 1 : 0},
        ${rank},
        ${new Date(cursor.createdAt).getTime() / 1000 * -1},
        ${cursor.id}
      )
    `);
  }

  const where = Prisma.join(conditions, " AND ");

  return Prisma.sql`
    SELECT id, society_id, resident_id, category, description, priority,
           current_status, is_overdue, created_at, updated_at
    FROM complaints
    WHERE ${where}
    ORDER BY
      is_overdue DESC,
      (CASE priority WHEN 'Low' THEN 0 WHEN 'Medium' THEN 1 WHEN 'High' THEN 2 END) DESC,
      created_at ASC,
      id DESC
    LIMIT ${limit + 1}
  `;
}
