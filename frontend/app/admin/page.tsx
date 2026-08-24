"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui/Panel";
import { api, type DashboardSummary } from "@/lib/api-client";

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "rose" }) {
  return (
    <Panel>
      <p className="field-label">{label}</p>
      <p className={`font-display text-display-md ${tone === "rose" ? "text-rose" : "text-ink"}`}>
        {value}
      </p>
    </Panel>
  );
}

export default function AdminOverviewPage() {
  const { user } = useCurrentUser(["society_admin", "super_admin"]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get<DashboardSummary>("/dashboard/summary").then(setSummary);
  }, [user]);

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 className="font-display text-display-sm text-ink">Overview</h1>
      <p className="mt-1 text-sm text-ink-soft">A snapshot of complaints across your society.</p>

      {!summary ? (
        <p className="mt-6 text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Open" value={summary.totalOpen} />
            <StatTile label="In progress" value={summary.totalInProgress} />
            <StatTile label="Resolved" value={summary.totalResolved} />
            <StatTile label="Overdue" value={summary.totalOverdue} tone="rose" />
          </div>

          <h2 className="mt-8 font-display text-display-sm text-ink">By category</h2>
          <Panel className="mt-3">
            {summary.byCategory.length === 0 ? (
              <p className="text-sm text-ink-soft">No complaints yet.</p>
            ) : (
              <div className="space-y-2">
                {summary.byCategory
                  .sort((a, b) => b.count - a.count)
                  .map((row) => {
                    const max = Math.max(...summary.byCategory.map((r) => r.count));
                    return (
                      <div key={row.category} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 truncate text-sm text-ink">{row.category}</span>
                        <div className="h-2 flex-1 rounded-sm bg-hairline">
                          <div
                            className="h-2 rounded-sm bg-clay"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-6 shrink-0 text-right text-sm text-ink-soft">{row.count}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </Panel>
        </>
      )}
    </AppShell>
  );
}
