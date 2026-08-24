"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Page } from "./api-client";

/**
 * Thin client-side wrapper around a cursor-paginated GET endpoint: loads
 * the first page on mount/dep change, and exposes loadMore() to append
 * the next page using nextCursor — mirrors the backend's cursor contract
 * directly rather than offset/page-number.
 */
export function usePaginatedList<T>(buildPath: (cursor: string | null) => string, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<Page<T>>(buildPath(null))
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err) => !cancelled && setError(err.message ?? "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await api.get<Page<T>>(buildPath(nextCursor));
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, buildPath]);

  return { items, setItems, nextCursor, loading, loadingMore, loadMore, error };
}
