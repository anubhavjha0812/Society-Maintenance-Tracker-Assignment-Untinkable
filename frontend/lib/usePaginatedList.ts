"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  // Bumped every time the deps change and the first page reloads.
  // loadMore() captures the generation it was called under and discards
  // its result if a newer generation has since started — otherwise a
  // slow "load more" that's still in flight when the filters change
  // would land after the reset and append stale rows onto the new list.
  const generationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    generationRef.current += 1;
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
    const generation = generationRef.current;
    setLoadingMore(true);
    try {
      const page = await api.get<Page<T>>(buildPath(nextCursor));
      if (generation !== generationRef.current) return;
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } finally {
      if (generation === generationRef.current) setLoadingMore(false);
    }
  }, [nextCursor, buildPath]);

  return { items, setItems, nextCursor, loading, loadingMore, loadMore, error };
}
