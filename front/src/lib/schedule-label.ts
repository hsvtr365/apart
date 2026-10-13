import { weekdayLabels, seasonLabels, type Post } from "./types";

export function scheduleLabel(post: Post, detail = false) {
  if (post.category === "NOTICE")
    return [post.noticeStartDate, post.noticeEndDate]
      .filter(Boolean)
      .join(" ~ ");
  const dates =
    post.scheduleType === "ONCE"
      ? [post.startDate, post.finishDate].filter(Boolean).join(" ~ ") ||
        "날짜 미정"
      : post.weekdays.length
        ? `매주 ${post.weekdays.map((day) => weekdayLabels[day]).join("·")}`
        : "요일 미정";
  const time = detail
    ? [
        post.arrivalTime && `${post.arrivalTime} 도착 예정`,
        post.departureTime && `${post.departureTime} 출발 예정`,
      ]
        .filter(Boolean)
        .join(" / ")
    : [post.arrivalTime, post.departureTime].filter(Boolean).join("~");
  return [
    post.scheduleType === "ONCE" && detail ? `1회 · ${dates}` : dates,
    time,
    post.seasons.map((season) => seasonLabels[season]).join("·"),
  ]
    .filter(Boolean)
    .join(" / ");
}
