"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui/Panel";
import { Badge, statusTone, priorityTone } from "@/components/ui/Badge";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { api, type Complaint, type ComplaintHistoryEntry } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function ComplaintDetailPage() {
  const { user } = useCurrentUser(["resident"]);
  const params = useParams<{ id: string }>();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [history, setHistory] = useState<ComplaintHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.get<Complaint>(`/complaints/${params.id}`),
      api.get<ComplaintHistoryEntry[]>(`/complaints/${params.id}/history`),
    ])
      .then(([c, h]) => {
        setComplaint(c);
        setHistory(h);
      })
      .finally(() => setLoading(false));
  }, [user, params.id]);

  if (!user) return null;

  return (
    <AppShell user={user}>
      {loading || !complaint ? (
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

          <div className="space-y-3">
            <Panel>
              <p className="field-label">Status</p>
              <Badge tone={statusTone(complaint.currentStatus)}>{complaint.currentStatus}</Badge>
            </Panel>
            <Panel>
              <p className="field-label">Priority</p>
              <Badge tone={priorityTone(complaint.priority)}>{complaint.priority}</Badge>
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
