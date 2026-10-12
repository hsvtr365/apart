import { test } from "node:test";
import assert from "node:assert/strict";
import { STALE_REPORT_MS, postStatus } from "../src/lib/freshness";
import { demoData } from "../src/lib/demo";
import { clock } from "../src/lib/types";

const now = new Date("2026-10-12T03:00:00Z");
const food = { ...demoData().posts[0], category: "FOOD" as const, scheduleType: "WEEKLY" as const, weekdays: [], seasons: [], presence: null, observedAt: null };
test("visit labels follow the schedule, independently of reports", () => {
  assert.deepEqual(postStatus(food, now), { schedule: "오늘와요", observation: "아직 제보가 없어요." });
  assert.equal(postStatus({ ...food, weekdays: [4] }, now).schedule, "오늘 안와요");
});
test("stale means at least four weeks, including the exact boundary", () => {
  const timestamp = new Date(now.getTime() - STALE_REPORT_MS).toISOString();
  const observed = { ...food, lastPresenceReport: { state: "ARRIVED" as const, observedAt: timestamp } };
  assert.equal(postStatus(observed, new Date(now.getTime() - 1)).observation, `${clock(timestamp)} (왔어요)`);
  assert.equal(postStatus(observed, now).observation, `${clock(timestamp)} (왔어요) · 오래된 제보`);
});
test("past-visit reports remain readable without becoming today's confirmation", () => {
  const observedAt = "2026-10-05T01:00:00Z";
  const post = { ...food, presenceOccurrence: "WEEKLY:2026-10-12", presenceConfirmed: false,
    lastPresenceReport: { state: "GONE" as const, observedAt } };
  assert.equal(postStatus(post, now).observation, `${clock(observedAt)} (갔어요)`);
  assert.equal(post.presence, null);
  assert.equal(post.presenceConfirmed, false);
});
test("notice expiry follows Korean date", () => {
  const notice = { ...food, category: "NOTICE" as const, noticeStartDate: "2026-10-11", noticeEndDate: "2026-10-12" };
  assert.equal(postStatus(notice, new Date("2026-10-12T14:59:59Z")).schedule, "공고 게시 중");
  assert.equal(postStatus(notice, new Date("2026-10-12T15:00:00Z")).schedule, "공고 게시 기간 종료");
});
