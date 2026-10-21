"use client";
import { useId, useState } from "react";
import { PresenceHistoryDialog } from "./presence-history";
import { CalendarDays } from "lucide-react";
import { Presence } from "./presence";
import { postStatus, STALE_REPORT_MS } from "@/lib/freshness";
import { clock, type Post } from "@/lib/types";
import { scheduleLabel } from "@/lib/schedule-label";
import { useVillage } from "./store";

export function PostStatus({ post }: { post: Post }) {
  const { now } = useVillage();
  const [historyOpen, setHistoryOpen] = useState(false);
  const panelId = useId();
  const status = postStatus(post, new Date(now));
  const report =
    post.lastPresenceReport ??
    (post.observedAt && post.presence
      ? { observedAt: post.observedAt, state: post.presence }
      : null);
  const schedule = scheduleLabel(post, true);
  return (
    <section className="detail-status" aria-label="일정과 현장 확인">
      {post.category === "NOTICE" ? (
        <>
          <p>{post.noticeKind === "ROUTINE" ? "일상공고" : "단기공고"} · {status.schedule}</p>
          {status.observation && <p>{status.observation}</p>}
          {post.noticeStartDate && (
            <p>
              {post.noticeStartDate} ~ {post.noticeEndDate}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="detail-status-top">
            <span
              className={`visit-status-tag ${status.schedule === "오늘와요" ? "visit-today" : "visit-not-today"}`}
            >
              <span aria-hidden="true">●</span>{" "}
              {status.schedule === "오늘와요" ? "오늘 와요" : "오늘 안와요"}
            </span>
            {post.category === "FOOD" && (
              <button
                type="button"
                className="detail-last-report"
                aria-label="최신 확인 기록 보기"
                aria-expanded={historyOpen}
                aria-controls={panelId}
                onClick={() => setHistoryOpen(true)}
              >
                {report ? (
                  <>
                    마지막 확인: {clock(report.observedAt)}{" "}
                    <span
                      className={`visit-status-tag ${report.state === "ARRIVED" ? "visit-today" : "visit-not-today"}`}
                    >
                      {report.state === "ARRIVED" ? "있어요" : "없어요"}
                    </span>
                    {now - new Date(report.observedAt).getTime() >=
                      STALE_REPORT_MS && " · 오래된 제보"}
                  </>
                ) : (
                  "아직 확인 없음"
                )}
              </button>
            )}
          </div>
          {post.category === "FOOD" && (
            <div className="detail-presence">
              <Presence post={post} detail hideHistory />
            </div>
          )}
          <div className="detail-schedule-card">
            <CalendarDays size={24} aria-hidden="true" />
            <div>
              <h2>방문 일정</h2>
              <p>{schedule}</p>
            </div>
          </div>
        </>
      )}
      {historyOpen && (
        <PresenceHistoryDialog
          post={post}
          panelId={panelId}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </section>
  );
}
