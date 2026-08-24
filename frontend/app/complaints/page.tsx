"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { usePaginatedList } from "@/lib/usePaginatedList";
import { Badge, statusTone, priorityTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import type { Complaint } from "@/lib/api-client";

export default function MyComplaintsPage() {
  const { user } = useCurrentUser(["resident"]);
  const { items, loading, loadingMore, nextCursor, loadMore } = usePaginatedList<Complaint>(
    (cursor) => `/complaints/mine?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
    [user?.id],
  );

  if (!user) return null;

  return (
    <AppShell user={user}>
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-display-sm text-ink">My complaints</h1>
          <p className="mt-1 text-sm text-ink-soft">Everything you've raised, and where it stands.</p>
        </div>
        <Link href="/complaints/new">
          <Button>New complaint</Button>
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState title="No complaints yet" hint="Raise one from the New complaint button above." />
        ) : (
          items.map((c) => (
            <Link
              key={c.id}
              href={`/complaints/${c.id}`}
              className="panel flex items-center justify-between p-4 transition-colors hover:border-ink"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-ink">{c.category}</p>
                  {c.isOverdue ? <Badge tone="rose">Overdue</Badge> : null}
                </div>
                <p className="mt-1 truncate text-sm text-ink-soft">{c.description}</p>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-3">
                <Badge tone={priorityTone(c.priority)}>{c.priority}</Badge>
                <Badge tone={statusTone(c.currentStatus)}>{c.currentStatus}</Badge>
                <span className="w-20 text-right text-xs text-ink-faint">{formatDate(c.createdAt)}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {nextCursor ? (
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </AppShell>
  );
}
