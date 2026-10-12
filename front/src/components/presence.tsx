"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { useVillage, request } from "./store";
import { Icon } from "./icons";
import type { Post, PresenceHistory } from "@/lib/types";
import { presenceOccurrence } from "@/lib/presence";
export function Presence({
  post,
  map = false,
}: {
  post: Post;
  map?: boolean;
}) {
  const { act, notify, busy, data } = useVillage();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [history, setHistory] = useState<PresenceHistory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const panelId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const el = dialog.current;
    if (open && el && !el.open) el.showModal();
    return () => {
      if (el) {
        el.close();
        trigger.current?.focus();
      }
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    pending.current = controller;
    setHistory(null);
    setError("");
    setLoading(true);
    const occurrence = presenceOccurrence(post);
    const result =
      data?.mode === "demo"
        ? Promise.resolve({
            occurrence,
            nextCursor: null,
            logs: (post.presenceHistory ?? []).filter(
              (log) => all || log.occurrence === occurrence,
            ),
          })
        : request<PresenceHistory>(
            `/api/posts/${post.id}/presence-history?scope=${all ? "all" : "current"}`,
            { signal: controller.signal },
          );
    void result
      .then((value) => {
        if (!controller.signal.aborted) setHistory(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, all, post, data?.mode, retry]);
  async function more() {
    if (!history?.nextCursor || loading) return;
    const controller = pending.current;
    if (!controller || controller.signal.aborted) return;
    setLoading(true);
    setError("");
    try {
      const next = await request<PresenceHistory>(
        `/api/posts/${post.id}/presence-history?scope=${all ? "all" : "current"}&cursor=${encodeURIComponent(history.nextCursor)}`,
        { signal: controller.signal },
      );
      setHistory((current) =>
        current === history
          ? { ...next, logs: [...current.logs, ...next.logs] }
          : current,
      );
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  if (post.adminDeleted || post.userDeleted) return null;
  return (
    <div className="presence-wrapper">
      <div className="presence">
        {(!map || !post.presenceConfirmed) &&
          (["ARRIVED", "GONE"] as const).map((state) => (
            <button
              type="button"
              className={`presence-state presence-${state.toLowerCase()}`}
              key={state}
              aria-pressed={post.presence === state}
              disabled={busy}
              onClick={() =>
                void act("presence", post.id, { state })
                  .then(() => {
                    notify("현장 상태를 반영했어요.");
                  })
                  .catch((e) => notify(e.message))
              }
            >
              {map && (
                <Icon
                  name={state === "ARRIVED" ? "check" : "close"}
                  strokeWidth="2.5"
                />
              )}
              {state === "ARRIVED" ? (map ? "있어요" : "왔어요") : "갔어요"}
            </button>
          ))}
        <button
          ref={trigger}
          type="button"
          className="presence-history-toggle"
          aria-label="왔어요·갔어요 기록 보기"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <Eye size={20} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <dialog
          ref={dialog}
          id={panelId}
          className="presence-history"
          aria-label="현장 확인 기록"
          onCancel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="presence-history-heading">
            <b>왔어요·갔어요 기록</b>
            <button
              type="button"
              className="icon-btn"
              aria-label="현장 확인 기록 닫기"
              onClick={() => setOpen(false)}
            >
              닫기
            </button>
          </div>
          <label className="presence-history-filter">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            지난 회차 포함
          </label>
          {!all && history && (
            <small className="block text-muted">
              이번 회차 · {history.occurrence.split(":")[1]}
            </small>
          )}
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
                    {log.state === "ARRIVED" ? "왔어요" : "갔어요"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {loading && <p role="status">기록을 불러오는 중…</p>}
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  history?.nextCursor
                    ? void more()
                    : setRetry((value) => value + 1)
                }
              >
                다시 시도
              </button>
            </div>
          )}
          {!loading && !error && history && !history.logs.length && (
            <p className="text-muted">
              {all
                ? "아직 확인 기록이 없어요."
                : "이번 회차에는 아직 확인 기록이 없어요."}
            </p>
          )}
          {history?.nextCursor && !error && (
            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={loading}
              onClick={() => void more()}
            >
              이전 기록 더 보기
            </button>
          )}
        </dialog>
      )}
    </div>
  );
}
