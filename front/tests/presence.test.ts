import { test } from "node:test";
import assert from "node:assert/strict";
import { presenceOccurrence, visitorAlias } from "../src/lib/presence";
const weekly = {
  scheduleType: "WEEKLY" as const,
  startDate: null,
  finishDate: null,
  weekdays: [4],
  seasons: [],
  arrivalTime: null,
  departureTime: null,
};
test("weekly confirmations reset at Korean midnight and next week's visit", () => {
  assert.equal(
    presenceOccurrence(weekly, new Date("2026-10-09T14:59:59Z")),
    "WEEKLY:2026-10-09",
  );
  assert.equal(
    presenceOccurrence(weekly, new Date("2026-10-09T15:00:00Z")),
    "WEEKLY:2026-10-10",
  );
  assert.equal(
    presenceOccurrence(weekly, new Date("2026-10-16T00:00:00Z")),
    "WEEKLY:2026-10-16",
  );
});
test("overnight visits belong to the previous scheduled day until departure", () => {
  const night = { ...weekly, arrivalTime: "20:00", departureTime: "02:00" };
  assert.equal(
    presenceOccurrence(night, new Date("2026-10-09T16:59:59Z")),
    "WEEKLY:2026-10-09",
  );
  assert.equal(
    presenceOccurrence(night, new Date("2026-10-09T17:00:00Z")),
    "WEEKLY:2026-10-10",
  );
  assert.equal(
    presenceOccurrence(night, new Date("2026-10-10T16:00:00Z")),
    "WEEKLY:2026-10-11",
  );
  assert.equal(
    presenceOccurrence(
      { ...night, weekdays: [] },
      new Date("2026-10-10T16:00:00Z"),
    ),
    "WEEKLY:2026-10-10",
  );
});
test("one-time multi-day visits have a single occurrence, rescheduling starts another", () => {
  const once = {
    ...weekly,
    scheduleType: "ONCE" as const,
    startDate: "2026-10-09",
    finishDate: "2026-10-11",
  };
  assert.equal(
    presenceOccurrence(once, new Date("2026-10-09T00:00:00Z")),
    presenceOccurrence(once, new Date("2026-10-11T00:00:00Z")),
  );
  assert.notEqual(
    presenceOccurrence(once),
    presenceOccurrence({ ...once, startDate: "2026-10-16" }),
  );
});
test("guest alias is stable and does not publish the visitor hash", () => {
  const visitor = "a7c2f19b" + "0".repeat(56);
  assert.equal(visitorAlias(visitor), "방문자 A7C2F19B");
  assert.equal(visitorAlias(visitor), visitorAlias(visitor));
  assert.notEqual(visitorAlias(visitor), visitorAlias("b".repeat(64)));
  assert(!visitorAlias(visitor).includes(visitor));
});
