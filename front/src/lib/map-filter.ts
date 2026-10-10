import type { Post } from "./types";

export function todayContext(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const weekday = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  const month = Number(today.slice(5, 7));
  const season = month >= 3 && month <= 5 ? "SPRING" : month >= 6 && month <= 8 ? "SUMMER" : month >= 9 && month <= 11 ? "AUTUMN" : "WINTER";
  return { today, weekday, season };
}

export function occursToday(post: Pick<Post, "scheduleType" | "weekdays" | "startDate" | "finishDate"> & Partial<Pick<Post, "seasons">>, now = new Date()) {
  const { today, weekday, season } = todayContext(now);
  if (post.scheduleType === "ONCE") return !!post.startDate && post.startDate <= today && today <= (post.finishDate || post.startDate);
  return post.weekdays.includes(weekday) && (!post.seasons?.length || post.seasons.includes(season));
}

export function isTodayNews(post: Post, now = new Date()) {
  if (post.category !== "NOTICE") return occursToday(post, now);
  const { today } = todayContext(now);
  return !!post.noticeStartDate && !!post.noticeEndDate && post.noticeStartDate <= today && today <= post.noticeEndDate;
}
