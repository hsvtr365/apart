import type { Post } from "./types";

export function todayContext(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const weekday = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  const [year, month, date] = today.split("-").map(Number);
  // Purple Mountain Observatory's 24-term date formula; Korea's season boundaries are the four 입절 dates.
  const termDay = (constant: number, beforeLeapDay = false) => {
    const y = year % 100;
    const leapCorrection = Math.floor((y - (beforeLeapDay ? 1 : 0)) / 4);
    return Math.floor(y * 0.2422 + constant) - leapCorrection;
  };
  const season =
    month * 100 + date < 200 + termDay(3.87, true)
      ? "WINTER"
      : month * 100 + date < 500 + termDay(5.52)
        ? "SPRING"
        : month * 100 + date < 800 + termDay(7.5)
          ? "SUMMER"
          : month * 100 + date < 1100 + termDay(7.438)
            ? "AUTUMN"
            : "WINTER";
  return { today, weekday, season };
}

export function occursToday(
  post: Pick<Post, "scheduleType" | "weekdays" | "startDate" | "finishDate"> &
    Partial<Pick<Post, "seasons">>,
  now = new Date(),
) {
  const { today, weekday, season } = todayContext(now);
  if (post.scheduleType === "ONCE")
    return (
      !!post.startDate &&
      post.startDate <= today &&
      today <= (post.finishDate || post.startDate)
    );
  return (
    (!post.weekdays.length || post.weekdays.includes(weekday)) &&
    (!post.seasons?.length || post.seasons.includes(season))
  );
}

export function isTodayNews(post: Post, now = new Date()) {
  if (post.hidden || post.adminDeleted) return false;
  if (post.category !== "NOTICE") return occursToday(post, now);
  const { today } = todayContext(now);
  return (
    !!post.noticeStartDate &&
    !!post.noticeEndDate &&
    post.noticeStartDate <= today &&
    today <= post.noticeEndDate
  );
}
