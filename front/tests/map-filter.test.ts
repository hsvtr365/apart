import { test } from "node:test";
import assert from "node:assert/strict";
import { occursToday, isTodayNews } from "../src/lib/map-filter";
import { demoData } from "../src/lib/demo";
const weekly = { scheduleType: "WEEKLY" as const, weekdays: [5], startDate: null, finishDate: null };
test("map schedule uses Korean date across midnight and Monday-based weekdays", () => {
  assert(occursToday(weekly, new Date("2026-10-09T15:00:00Z")));
  assert(!occursToday(weekly, new Date("2026-10-09T14:59:00Z")));
  assert(!occursToday({...weekly, weekdays: []}, new Date("2026-10-10T00:00:00Z")));
});
test("weekly food and market news require the weekday and any specified season", () => {
  const today = new Date("2026-10-10T00:00:00Z");
  for (const category of ["FOOD", "MARKET"] as const) {
    const post = {...demoData().posts[0], ...weekly, category, seasons: ["AUTUMN"]};
    assert(isTodayNews(post, today));
    assert(!isTodayNews({...post, weekdays: [4]}, today));
    assert(!isTodayNews({...post, seasons: ["WINTER"]}, today));
    assert(!isTodayNews({...post, weekdays: []}, today));
  }
});
test("notice news use the announcement period regardless of visit schedules", () => {
  const post = {...demoData().posts[0], category: "NOTICE" as const, noticeStartDate: "2026-10-10", noticeEndDate: "2026-10-11"};
  assert(isTodayNews(post, new Date("2026-10-09T15:00:00Z")));
  assert(isTodayNews(post, new Date("2026-10-11T14:59:59Z")));
  assert(!isTodayNews(post, new Date("2026-10-11T15:00:00Z")));
  assert(!isTodayNews({...post, noticeEndDate: null}, new Date("2026-10-10T00:00:00Z")));
});
test("one-time schedules include both endpoints, or only opening day if leaving day is unknown", () => {
  const once = {...weekly, scheduleType: "ONCE" as const, startDate: "2026-10-10", finishDate: "2026-10-11"};
  assert(occursToday(once, new Date("2026-10-11T00:00:00Z")));
  assert(!occursToday(once, new Date("2026-10-12T00:00:00Z")));
  assert(!occursToday({...once, finishDate: null}, new Date("2026-10-11T00:00:00Z")));
});
