"use client";
import { postStatus, STALE_REPORT_MS } from "@/lib/freshness";
import { clock, weekdayLabels, seasonLabels, type Post } from "@/lib/types";
import { useVillage } from "./store";

export function PostStatus({ post }: { post: Post }) {
  const { now } = useVillage();
  const status = postStatus(post, new Date(now));
  const report = post.lastPresenceReport ?? (post.observedAt && post.presence ? { observedAt: post.observedAt, state: post.presence } : null);
  const schedule = [
    post.scheduleType === "ONCE" ? `1회 · ${post.startDate ?? "날짜 미정"}${post.finishDate ? ` ~ ${post.finishDate}` : ""}` : `매주 ${post.weekdays?.map(day => weekdayLabels[day]).join("·") || "요일 미정"}`,
    post.arrivalTime ? `${post.arrivalTime} 도착 예정` : "",
    post.departureTime ? `${post.departureTime} 출발 예정` : "",
    post.seasons?.map(season => seasonLabels[season]).join("·"),
  ].filter(Boolean).join(" / ");
  return <div className="my-3 text-xs text-muted" aria-label="일정과 현장 확인">
    {post.category === "NOTICE" ? <><p>{status.schedule}</p>{status.observation && <p>{status.observation}</p>}</> : <>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`visit-status-tag ${status.schedule === "오늘와요" ? "visit-today" : "visit-not-today"}`}>{status.schedule}</span>
        <span>{schedule}</span>
      </div>
      {post.category === "FOOD" && (report ? <div className="mt-2 flex flex-wrap items-center gap-1">
        <span>마지막 확인: {clock(report.observedAt)}</span>
        <span className={`visit-status-tag ${report.state === "ARRIVED" ? "visit-today" : "visit-not-today"}`}>{report.state === "ARRIVED" ? "있어요" : "없어요"}</span>
        {now - new Date(report.observedAt).getTime() >= STALE_REPORT_MS && <span>· 오래된 제보</span>}
      </div> : <p className="mt-2">아직 제보가 없어요.</p>)}
    </>}
  </div>;
}
