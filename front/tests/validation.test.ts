import { test } from "node:test";
import assert from "node:assert/strict";
import { postSchema, ending } from "../src/lib/validation";
test("title limits and unsafe image URLs are rejected", () => {
  const valid = {
    title: "붕어빵",
    body: "정문에서 판매해요",
    category: "FOOD",
    place: "정문",
    mapX: 25,
    mapY: 60,
    imageUrl: null,
    endDate: null,
    endTime: null,
  };
  assert(postSchema.safeParse(valid).success);
  assert(!postSchema.safeParse({ ...valid, title: "가".repeat(16) }).success);
  assert(
    !postSchema.safeParse({ ...valid, imageUrl: "https://evil.example/photo" })
      .success,
  );
  assert(!postSchema.safeParse({ ...valid, mapY: null }).success);
  assert(
    postSchema.safeParse({ ...valid, latitude: 37.6, longitude: 126.8 })
      .success,
  );
  assert(!postSchema.safeParse({ ...valid, latitude: 37.6 }).success);
  assert(
    !postSchema.safeParse({ ...valid, latitude: 91, longitude: 126.8 }).success,
  );
});
test("ending distinguishes unspecified time and rejects impossible dates", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(ending("2026-01-02", null, now).endTime, null);
  assert.equal(
    ending("2026-01-02", null, now).endsAt?.toISOString(),
    "2026-01-02T14:59:00.000Z",
  );
  assert.throws(() => ending("2026-02-30", null, now));
  assert.throws(() => ending("2025-12-31", "12:00", now));
});
