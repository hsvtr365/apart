import type { Post } from "./types";

export function occursToday(post: Pick<Post, "scheduleType" | "weekdays" | "startDate" | "finishDate">, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const weekday = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  if (post.scheduleType === "ONCE") return !!post.startDate && post.startDate <= today && today <= (post.finishDate || post.startDate);
  return !post.weekdays.length || post.weekdays.includes(weekday);
}
