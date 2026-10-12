"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { request, useVillage } from "./store";
import { useDetailDialog } from "./use-detail-dialog";
import type { Post, PresenceHistory } from "@/lib/types";

export function PresenceHistoryDialog({
  post,
  panelId,
  onClose,
}: {
  post: Post;
  panelId: string;
  onClose: () => void;
}) {
  const { data } = useVillage();
  const dialogProps = useDetailDialog(onClose);
  const [history, setHistory] = useState<PresenceHistory | null>(null);
  const [older, setOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const fetching = useRef(false);
  const sentinel = useRef<HTMLButtonElement>(null);
  const fetchPage = useCallback(
    async (
      scope: "recent" | "older",
      signal: AbortSignal,
      cursor?: string | null,
      boundary?: string,
    ): Promise<PresenceHistory> => {
      const cutoff =
        boundary ?? new Date(Date.now() - 28 * 86400000).toISOString();
      if (data?.mode === "demo") {
        const all = [...(post.presenceHistory ?? [])].sort(
          (a, b) =>
            b.observedAt.localeCompare(a.observedAt) ||
            b.id.localeCompare(a.id),
        );
        const filtered = all.filter((log) =>
          scope === "recent"
            ? log.observedAt >= cutoff
            : log.observedAt < cutoff,
        );
        const start = cursor
          ? filtered.findIndex((log) => log.id === cursor) + 1
          : 0;
        const logs = filtered.slice(start, start + 30);
        return {
          occurrence: post.presenceOccurrence ?? "",
          boundary: cutoff,
          logs,
          hasOlder:
            scope === "recent" && all.some((log) => log.observedAt < cutoff),
          nextCursor: start + 30 < filtered.length ? logs.at(-1)!.id : null,
        };
      }
      const params = new URLSearchParams({ scope, boundary: cutoff });
      if (cursor) params.set("cursor", cursor);
      return request<PresenceHistory>(
        `/api/posts/${post.id}/presence-history?${params}`,
        { signal },
      );
    },
    [data?.mode, post.id, post.presenceHistory, post.presenceOccurrence],
  );
  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    fetching.current = true;
    setHistory(null);
    setOlder(false);
    setLoading(true);
    setError("");
    void fetchPage("recent", controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setHistory(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          fetching.current = false;
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [fetchPage, retry]);
  const more = useCallback(async () => {
    const controller = pending.current;
    if (
      !history ||
      (!history.nextCursor && !history.hasOlder) ||
      fetching.current ||
      !controller ||
      controller.signal.aborted
    )
      return;
    fetching.current = true;
    setLoading(true);
    setError("");
    const nextOlder = older || !history.nextCursor;
    try {
      const next = await fetchPage(
        nextOlder ? "older" : "recent",
        controller.signal,
        history.nextCursor,
        history.boundary,
      );
      if (!controller.signal.aborted) {
        setOlder(nextOlder);
        setHistory({
          ...next,
          logs: [
            ...history.logs,
            ...next.logs.filter(
              (log) => !history.logs.some((existing) => existing.id === log.id),
            ),
          ],
        });
      }
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) {
        fetching.current = false;
        setLoading(false);
      }
    }
  }, [history, older, fetchPage]);
  useEffect(() => {
    if (loading || error || !sentinel.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void more();
      },
      { root: dialogProps.ref.current },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loading, error, more, dialogProps.ref]);
  const hasMore = !!(history?.nextCursor || history?.hasOlder);
  return createPortal(
    <dialog
      {...dialogProps}
      id={panelId}
      className="detail-dialog"
      aria-label="있어요·없어요 기록"
    >
      <div className="post-detail-header">
        <h1 className="post-detail-title">있어요·없어요 기록</h1>
        <button
          type="button"
          className="icon-btn"
          aria-label="현장 확인 기록 닫기"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="detail-body">
        <p className="text-sm text-muted">
          최근 4주부터 최신순으로 보여드려요.
        </p>
        <ul className="presence-history-list">
          {history?.logs.map((log) => (
            <li key={log.id}>
              <time dateTime={log.observedAt}>
                {new Intl.DateTimeFormat("ko-KR", {
                  timeZone: "Asia/Seoul",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }).format(new Date(log.observedAt))}
              </time>
              <div>
                <b>{log.nickname}</b>
                <span className={`presence-log-${log.state.toLowerCase()}`}>
                  {log.state === "ARRIVED" ? "있어요" : "없어요"}
                </span>
              </div>
            </li>
          ))}
        </ul>
        {loading && (
          <p role="status" className="py-3 text-muted">
            기록을 불러오는 중…
          </p>
        )}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button
              className="btn btn-secondary"
              onClick={() =>
                history ? void more() : setRetry((value) => value + 1)
              }
            >
              다시 시도
            </button>
          </div>
        )}
        {!loading && !error && history && !older && !history.logs.length && (
          <p className="py-3 text-muted">최근 4주 기록이 없어요.</p>
        )}
        {hasMore && !error && (
          <button
            ref={sentinel}
            className="btn btn-secondary w-full"
            disabled={loading}
            onClick={() => void more()}
          >
            더보기
          </button>
        )}
        {!loading && !error && history && !hasMore && (
          <p className="py-3 text-center text-muted">이전 기록이 없어요.</p>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
