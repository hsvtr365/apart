import { todayContext, occursToday } from "./map-filter";
import type { Post } from "./types";

type Schedule = Pick<
  Post,
  | "startDate"
  | "finishDate"
  | "weekdays"
  | "seasons"
  | "arrivalTime"
  | "departureTime"
> & { scheduleType: string };

export function presenceOccurrence(post: Schedule, now = new Date()) {
  if (post.scheduleType === "ONCE" && post.startDate)
    return `ONCE:${post.startDate}`;
  let date = todayContext(now).today;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  if (
    post.arrivalTime &&
    post.departureTime &&
    post.departureTime < post.arrivalTime &&
    time < post.departureTime
  ) {
    const previous = new Date(now.getTime() - 86_400_000);
    if (occursToday({ ...post, scheduleType: "WEEKLY" }, previous))
      date = todayContext(previous).today;
  }
  return `WEEKLY:${date}`;
}

export function visitorAlias(visitorHash: string) {
  return `방문자 ${visitorHash.slice(0, 8).toUpperCase()}`;
}
