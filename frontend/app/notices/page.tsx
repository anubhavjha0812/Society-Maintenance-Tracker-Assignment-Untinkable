"use client";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { usePaginatedList } from "@/lib/usePaginatedList";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import type { Notice } from "@/lib/api-client";

export default function NoticesPage() {
  const { user } = useCurrentUser();
  const { items, loading, loadingMore, nextCursor, loadMore } = usePaginatedList<Notice>(
    (cursor) => `/notices?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
    [user?.id],
  );

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 className="font-display text-display-sm text-ink">Notices</h1>
      <p className="mt-1 text-sm text-ink-soft">Announcements from your society admin.</p>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState title="No notices yet" />
        ) : (
          items.map((n) => (
            <Panel key={n.id} className={n.isImportant ? "border-clay" : ""}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base text-ink">{n.title}</h3>
                {n.isImportant ? <Badge tone="clay">Important</Badge> : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{n.body}</p>
              <p className="mt-3 text-xs text-ink-faint">{formatDate(n.createdAt)}</p>
            </Panel>
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
