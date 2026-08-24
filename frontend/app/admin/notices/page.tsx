"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { usePaginatedList } from "@/lib/usePaginatedList";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Panel, EmptyState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { api, newIdempotencyKey, type Notice } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function AdminNoticesPage() {
  const { user } = useCurrentUser(["society_admin", "super_admin"]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { items, setItems, loading, loadingMore, nextCursor, loadMore } = usePaginatedList<Notice>(
    (cursor) => `/notices?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
    [user?.id],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const notice = await api.post<Notice>("/notices", { title, body, isImportant }, newIdempotencyKey());
      setItems((prev) => (notice.isImportant ? [notice, ...prev] : [...prev, notice]));
      setTitle("");
      setBody("");
      setIsImportant(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 className="font-display text-display-sm text-ink">Notices</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Important notices pin to the top and email every resident in the society.
      </p>

      <Panel className="mt-6 max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title" htmlFor="title">
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Body" htmlFor="body">
            <Textarea id="body" required value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isImportant}
              onChange={(e) => setIsImportant(e.target.checked)}
              className="h-4 w-4 rounded border-hairline accent-clay"
            />
            Mark as important (emails every resident)
          </label>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Posting…" : "Post notice"}
          </Button>
        </form>
      </Panel>

      <h2 className="mt-10 font-display text-display-sm text-ink">Posted</h2>
      <div className="mt-4 space-y-3">
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
