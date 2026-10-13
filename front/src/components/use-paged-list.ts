"use client";
import { useEffect, useRef, useState } from "react";

type Page<T, V> = { items: T[]; nextCursor: string | null; value: V };
export function usePagedList<T extends { id: string }, V>(
  key: string,
  enabled: boolean,
  revision: unknown,
  load: (
    cursor: string | undefined,
    signal: AbortSignal,
  ) => Promise<Page<T, V>>,
) {
  const loader = useRef(load);
  loader.current = load;
  const pages = useRef(1);
  const previousKey = useRef(key);
  const controller = useRef<AbortController | null>(null);
  const fetching = useRef(false);
  const [page, setPage] = useState<Page<T, V> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    if (previousKey.current !== key) {
      previousKey.current = key;
      pages.current = 1;
      setPage(null);
    }
    setError("");
    fetching.current = enabled;
    setLoading(enabled);
    if (!enabled) {
      setPage(null);
      return () => request.abort();
    }
    async function refresh() {
      let result = await loader.current(undefined, request.signal);
      const items = [...result.items];
      let count = 1;
      while (
        count < pages.current &&
        result.nextCursor &&
        !request.signal.aborted
      ) {
        result = await loader.current(result.nextCursor, request.signal);
        items.push(
          ...result.items.filter(
            (item) => !items.some((old) => old.id === item.id),
          ),
        );
        count++;
      }
      if (!request.signal.aborted) {
        pages.current = count;
        setPage({ ...result, items });
      }
    }
    void refresh()
      .catch((e) => {
        if (!request.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!request.signal.aborted) {
          fetching.current = false;
          setLoading(false);
        }
      });
    return () => request.abort();
  }, [key, enabled, revision]);
  async function more() {
    const request = controller.current;
    if (
      !page?.nextCursor ||
      fetching.current ||
      !request ||
      request.signal.aborted
    )
      return;
    fetching.current = true;
    setLoading(true);
    setError("");
    try {
      const next = await loader.current(page.nextCursor, request.signal);
      if (!request.signal.aborted) {
        pages.current++;
        setPage({
          ...next,
          items: [
            ...page.items,
            ...next.items.filter(
              (item) => !page.items.some((old) => old.id === item.id),
            ),
          ],
        });
      }
    } catch (e) {
      if (!request.signal.aborted) setError((e as Error).message);
    } finally {
      if (!request.signal.aborted) {
        fetching.current = false;
        setLoading(false);
      }
    }
  }
  return { page, loading, error, more };
}
