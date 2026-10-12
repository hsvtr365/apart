import { test } from "node:test";
import assert from "node:assert/strict";
import { freshnessMinutes, postStatus } from "../src/lib/freshness";
import { demoData } from "../src/lib/demo";

const now = new Date("2026-10-12T03:00:00Z");
const food = {
  ...demoData().posts[0],
  category: "FOOD" as const,
  scheduleType: "WEEKLY" as const,
  weekdays: [],
  seasons: [],
  presenceOccurrence: "WEEKLY:2026-10-12",
  presence: null,
  observedAt: null,
};
test("scheduled visits never imply an arrival without a current observation", () => {
  assert.deepEqual(postStatus(food, now), {
    schedule: "오늘 방문 예정",
    observation: "이번 회차 현장 확인 없음",
  });
  assert.equal(
    postStatus(
      {
        ...food,
        presence: "GONE",
        observedAt: now.toISOString(),
        presenceOccurrence: "WEEKLY:2026-10-05",
      },
      now,
    ).observation,
    "이번 회차 현장 확인 없음",
  );
});
test("arrival/departure reports age independently of the schedule and respect the trial window", () => {
  const observed = {
    ...food,
    presence: "GONE" as const,
    observedAt: "2026-10-12T01:00:00Z",
  };
  assert.equal(
    postStatus(observed, now).observation,
    "최근 현장 확인 · 갔어요 제보",
  );
  assert.equal(
    postStatus(observed, new Date(now.getTime() + 1)).observation,
    "확인 오래됨 · 갔어요 제보",
  );
  assert.equal(
    postStatus({ ...observed, presence: "ARRIVED" }, now, 60).observation,
    "확인 오래됨 · 왔어요 제보",
  );
  assert.equal(
    postStatus({ ...observed, observedAt: "2026-10-12T04:00:00Z" }, now)
      .observation,
    "확인 오래됨 · 갔어요 제보",
  );
});
test("notice expiry follows Korean date and does not claim the work has ended", () => {
  const notice = {
    ...food,
    category: "NOTICE" as const,
    noticeStartDate: "2026-10-11",
    noticeEndDate: "2026-10-12",
  };
  assert.equal(
    postStatus(notice, new Date("2026-10-12T14:59:59Z")).schedule,
    "공고 게시 중",
  );
  assert.deepEqual(postStatus(notice, new Date("2026-10-12T15:00:00Z")), {
    schedule: "공고 게시 기간 종료",
    observation: "실제 종료 여부는 원문을 확인해주세요.",
  });
});
test("invalid freshness config falls back to the documented trial value", () => {
  for (const value of [undefined, "", "0", "-1", "NaN", "1441"])
    assert.equal(freshnessMinutes(value), 120);
  assert.equal(freshnessMinutes("45"), 45);
});
