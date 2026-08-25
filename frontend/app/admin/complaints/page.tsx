"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { AppShell } from "@/components/AppShell";
import { usePaginatedList } from "@/lib/usePaginatedList";
import { Badge, statusTone, priorityTone } from "@/components/ui/Badge";
import { Select, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Panel";
import { formatAge } from "@/lib/format";
import { COMPLAINT_CATEGORIES } from "@/lib/categories";
import type { Complaint } from "@/lib/api-client";

interface Filters {
  category: string;
  status: string;
  priority: string;
  from: string; // yyyy-mm-dd, from a native date input
  to: string; // yyyy-mm-dd, from a native date input
  search: string;
}

const EMPTY_FILTERS: Filters = { category: "", status: "", priority: "", from: "", to: "", search: "" };

export default function AdminComplaintsPage() {
  const { user } = useCurrentUser(["society_admin", "super_admin"]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  // Search is the one free-text filter — debounced so typing doesn't fire
  // a request per keystroke the way the dropdown/date filters do per click.
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { items, loading, loadingMore, nextCursor, loadMore } = usePaginatedList<Complaint>(
    (cursor) => {
      const params = new URLSearchParams({ limit: "25" });
      if (cursor) params.set("cursor", cursor);
      if (filters.category) params.set("category", filters.category);
      if (filters.status) params.set("status", filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      // Dates come from <input type="date"> as yyyy-mm-dd; the backend
      // wants full date-time strings, so pin "from" to the start of that
      // day and "to" to the end of it (inclusive range).
      if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
      if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59`).toISOString());
      if (filters.search) params.set("search", filters.search);
      return `/complaints?${params.toString()}`;
    },
    [user?.id, filters.category, filters.status, filters.priority, filters.from, filters.to, filters.search],
  );

  if (!user) return null;

  return (
    <AppShell user={user}>
      <h1 className="font-display text-display-sm text-ink">Complaints</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Sorted overdue first, then by priority, then by how long they've waited.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Input
          type="search"
          placeholder="Search category or description…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-64"
        />
        <Select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          className="w-auto"
        >
          <option value="">All categories</option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="w-auto"
        >
          <option value="">All statuses</option>
          <option value="Open">Open</option>
          <option value="InProgress">In progress</option>
          <option value="Resolved">Resolved</option>
        </Select>
        <Select
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className="w-auto"
        >
          <option value="">All priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </Select>
        <Input
          type="date"
          aria-label="From date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="w-auto"
        />
        <Input
          type="date"
          aria-label="To date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="w-auto"
        />
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              setFilters(EMPTY_FILTERS);
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="mt-5 panel overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-ink-soft">Loading…</p>
        ) : items.length === 0 ? (
          <div className="p-2">
            <EmptyState title="No complaints match these filters" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-medium">Complaint</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-hairline last:border-0 hover:bg-paper">
                  <td className="px-4 py-3">
                    <Link href={`/admin/complaints/${c.id}`} className="block">
                      <span className="font-medium text-ink">{c.category}</span>
                      <span className="ml-2 text-ink-faint">{c.description.slice(0, 60)}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={priorityTone(c.priority)}>{c.priority}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(c.currentStatus)}>{c.currentStatus}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={c.isOverdue ? "font-medium text-rose" : "text-ink-soft"}>
                      {formatAge(c.createdAt)}
                      {c.isOverdue ? " · overdue" : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
