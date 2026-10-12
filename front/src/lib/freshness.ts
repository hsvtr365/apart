import { occursToday, todayContext } from "./map-filter";
import { clock, type Post } from "./types";

export const STALE_REPORT_MS = 28 * 24 * 60 * 60 * 1000;

export function postStatus(post: Post, now = new Date()) {
  if (post.category === "NOTICE") {
    const { today } = todayContext(now);
    if (post.noticeEndDate && post.noticeEndDate < today)
      return { schedule: "공고 게시 기간 종료", observation: "실제 종료 여부는 원문을 확인해주세요." };
    return { schedule: post.noticeStartDate && post.noticeStartDate > today ? "공고 게시 예정" : "공고 게시 중", observation: "" };
  }
  const schedule = occursToday(post, now) ? "오늘와요" : "오늘 안와요";
  if (post.category !== "FOOD") return { schedule, observation: "" };
  const report = post.lastPresenceReport ?? (post.observedAt && post.presence
    ? { observedAt: post.observedAt, state: post.presence } : null);
  if (!report) return { schedule, observation: "아직 제보가 없어요." };
  const stale = now.getTime() - new Date(report.observedAt).getTime() >= STALE_REPORT_MS;
  const state = report.state === "ARRIVED" ? "왔어요" : "갔어요";
  return { schedule, observation: `${clock(report.observedAt)} (${state})${stale ? " · 오래된 제보" : ""}` };
}
