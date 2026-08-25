"use client";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { usePaginatedList } from "@/lib/usePaginatedList";
import { EmptyState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import type { Resident } from "@/lib/api-client";

export default function AdminResidentsPage() {
  const { user } = useCurrentUser(["society_admin", "super_admin"]);
  const { items, loading, loadingMore, nextCursor, loadMore } = usePaginatedList<Resident>(
    (cursor) => `/society/residents?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
    [user?.id],
  );

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 className="font-display text-display-sm text-ink">Residents</h1>
      <p className="mt-1 text-sm text-ink-soft">Everyone registered in your society.</p>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState title="No residents yet" hint="They'll show up here once they register." />
        ) : (
          <div className="panel divide-y divide-hairline">
            {items.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{r.name}</p>
                  <p className="truncate text-sm text-ink-soft">{r.email}</p>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-6 text-sm text-ink-soft">
                  <span className="w-20 text-right">{r.flatNumber ?? "—"}</span>
                  <span className="w-32 text-right">{r.phone ?? "—"}</span>
                  <span className="w-24 text-right text-xs text-ink-faint">
                    Joined {formatDate(r.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
