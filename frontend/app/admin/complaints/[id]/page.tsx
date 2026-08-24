"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui/Panel";
import { Badge, statusTone, priorityTone } from "@/components/ui/Badge";
import { Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { api, newIdempotencyKey, type Complaint, type ComplaintHistoryEntry, type Priority } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

const NEXT_STATUS: Record<string, "InProgress" | "Resolved" | null> = {
  Open: "InProgress",
  InProgress: "Resolved",
  Resolved: null,
};

export default function AdminComplaintDetailPage() {
  const { user } = useCurrentUser(["society_admin", "super_admin"]);
  const params = useParams<{ id: string }>();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [history, setHistory] = useState<ComplaintHistoryEntry[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [c, h] = await Promise.all([
      api.get<Complaint>(`/complaints/${params.id}`),
      api.get<ComplaintHistoryEntry[]>(`/complaints/${params.id}/history`),
    ]);
    setComplaint(c);
    setHistory(h);
  }

  useEffect(() => {
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, params.id]);

  async function handlePriorityChange(priority: Priority) {
    if (!complaint) return;
    setBusy(true);
    try {
      const updated = await api.patch<Complaint>(`/complaints/${complaint.id}/priority`, { priority });
      setComplaint(updated);
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusAction(status: "InProgress" | "Resolved" | "Reopened") {
    if (!complaint) return;
    setBusy(true);
    try {
      await api.patch(
        `/complaints/${complaint.id}/status`,
        { status, note: note || undefined },
        newIdempotencyKey(),
      );
      setNote("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  const nextStatus = complaint ? NEXT_STATUS[complaint.currentStatus] : null;

  return (
    <AppShell user={user}>
      {!complaint ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-display-sm text-ink">{complaint.category}</h1>
              {complaint.isOverdue ? <Badge tone="rose">Overdue</Badge> : null}
            </div>
            <p className="mt-1 text-xs text-ink-faint">Raised {formatDate(complaint.createdAt)}</p>

            <Panel className="mt-5">
              <p className="text-sm leading-relaxed text-ink">{complaint.description}</p>
              {complaint.photos && complaint.photos.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {complaint.photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={`${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL}/${photo.objectStorageKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-clay hover:underline"
                    >
                      View photo
                    </a>
                  ))}
                </div>
              ) : null}
            </Panel>

            <h2 className="mt-8 font-display text-display-sm text-ink">History</h2>
            <Panel className="mt-3">
              <HistoryTimeline entries={history} />
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel>
              <p className="field-label">Status</p>
              <Badge tone={statusTone(complaint.currentStatus)}>{complaint.currentStatus}</Badge>
            </Panel>

            <Panel>
              <p className="field-label">Priority</p>
              <Select
                value={complaint.priority}
                disabled={busy}
                onChange={(e) => handlePriorityChange(e.target.value as Priority)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </Select>
            </Panel>

            <Panel>
              <p className="field-label">Note (optional)</p>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context…" />
              <div className="mt-3 flex flex-col gap-2">
                {nextStatus ? (
                  <Button disabled={busy} onClick={() => handleStatusAction(nextStatus)}>
                    Move to {nextStatus === "InProgress" ? "In Progress" : "Resolved"}
                  </Button>
                ) : (
                  <Button variant="secondary" disabled={busy} onClick={() => handleStatusAction("Reopened")}>
                    Reopen
                  </Button>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
