import { test } from "node:test";
import assert from "node:assert/strict";
import { occursToday } from "../src/lib/map-filter";
const weekly = { scheduleType: "WEEKLY" as const, weekdays: [5], startDate: null, finishDate: null };
test("map schedule uses Korean date across midnight and Monday-based weekdays", () => {
  assert(occursToday(weekly, new Date("2026-10-09T15:00:00Z")));
  assert(!occursToday(weekly, new Date("2026-10-09T14:59:00Z")));
  assert(occursToday({...weekly, weekdays: []}, new Date("2026-10-10T00:00:00Z")));
});
test("one-time schedules include both endpoints, or only opening day if leaving day is unknown", () => {
  const once = {...weekly, scheduleType: "ONCE" as const, startDate: "2026-10-10", finishDate: "2026-10-11"};
  assert(occursToday(once, new Date("2026-10-11T00:00:00Z")));
  assert(!occursToday(once, new Date("2026-10-12T00:00:00Z")));
  assert(!occursToday({...once, finishDate: null}, new Date("2026-10-11T00:00:00Z")));
});
