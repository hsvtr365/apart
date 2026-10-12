import { occursToday, todayContext } from "./map-filter";
import { presenceOccurrence } from "./presence";
import type { Post } from "./types";

// Trial value, adjustable after observing actual vendor visit durations.
export function freshnessMinutes(value?: string) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440
    ? minutes
    : 120;
}

export function postStatus(post: Post, now = new Date(), minutes = 120) {
  if (post.category === "NOTICE") {
    const { today } = todayContext(now);
    if (post.noticeEndDate && post.noticeEndDate < today)
      return {
        schedule: "공고 게시 기간 종료",
        observation: "실제 종료 여부는 원문을 확인해주세요.",
      };
    return {
      schedule:
        post.noticeStartDate && post.noticeStartDate > today
          ? "공고 게시 예정"
          : "공고 게시 중",
      observation: "",
    };
  }
  const schedule = occursToday(post, now)
    ? "오늘 방문 예정"
    : "오늘 예정된 방문 아님";
  if (post.category !== "FOOD") return { schedule, observation: "" };
  const current =
    !post.presenceOccurrence ||
    post.presenceOccurrence === presenceOccurrence(post, now);
  if (!current || !post.observedAt || !post.presence)
    return { schedule, observation: "이번 회차 현장 확인 없음" };
  const age = now.getTime() - new Date(post.observedAt).getTime();
  const report = post.presence === "ARRIVED" ? "왔어요 제보" : "갔어요 제보";
  return {
    schedule,
    observation: `${age >= 0 && age <= minutes * 60_000 ? "최근 현장 확인" : "확인 오래됨"} · ${report}`,
  };
}
