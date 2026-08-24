import { Badge, statusTone } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import type { ComplaintHistoryEntry } from "@/lib/api-client";

export function HistoryTimeline({ entries }: { entries: ComplaintHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-soft">No history yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, i) => (
        <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-clay" />
            {i < entries.length - 1 ? <span className="mt-1 w-px flex-1 bg-hairline" /> : null}
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(entry.status)}>{entry.status}</Badge>
              <span className="text-xs text-ink-faint">{formatDateTime(entry.timestamp)}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              by {entry.actor.name} · {entry.actor.role === "resident" ? "Resident" : "Admin"}
            </p>
            {entry.note ? <p className="mt-1 text-sm text-ink">{entry.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
