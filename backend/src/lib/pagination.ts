/**
 * Cursor pagination helpers.
 *
 * Cursor = base64url({ createdAt: ISO string, id: string }) so ordering is
 * stable even when multiple rows share the same createdAt millisecond
 * (ties are broken by id). Never use offset/page-number — see spec.
 */

export interface Cursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.id === "string"
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

/**
 * Builds a Prisma `where` fragment for "rows strictly after this cursor"
 * assuming descending order by (createdAt, id). Callers spread this into
 * their own where clause alongside tenant/status/etc. filters.
 */
export function afterCursorWhere(cursor: Cursor | null) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: new Date(cursor.createdAt) } },
      {
        createdAt: new Date(cursor.createdAt),
        id: { lt: cursor.id },
      },
    ],
  };
}

export function buildPage<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null;
  return { items, nextCursor };
}
