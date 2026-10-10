import { test } from "node:test";
import assert from "node:assert/strict";
import { postSchema, profileSchema } from "../src/lib/validation";
test("building is optional and limited to the apartment's 17 buildings", () => {
  for (let i = 2001; i <= 2017; i++)
    assert(
      profileSchema.safeParse({ nickname: "이웃", building: `${i}동` }).success,
    );
  assert(profileSchema.safeParse({ nickname: "이웃", building: null }).success);
  for (const building of ["2000동", "2018동", "103동", "임의 입력"])
    assert(!profileSchema.safeParse({ nickname: "이웃", building }).success);
});
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
test("optional recurring schedule validates values and supports overnight visits", () => {
  const base = {title:"test",body:"test",category:"FOOD",mapX:null,mapY:null,imageUrl:null};
  const empty = postSchema.parse(base);
  assert.deepEqual(empty.weekdays, []);
  assert.equal(empty.arrivalTime, null);
  assert(postSchema.safeParse({...base, weekdays:[0,6],seasons:["WINTER"],arrivalTime:"22:00",departureTime:"01:00"}).success);
  for (const patch of [{weekdays:[7]}, {weekdays:[1.5]}, {seasons:["bad"]}, {arrivalTime:"24:00"}, {departureTime:"12:60"}])
    assert(!postSchema.safeParse({...base,...patch}).success);
  assert.deepEqual(postSchema.parse({...base,weekdays:[1,1]}).weekdays,[1]);
  assert(!("place" in postSchema.parse({...base,place:"old"})));
});
test("weekly and one-time schedules keep only their own fields", () => {
  const base = {title:"test",body:"test",category:"FOOD",mapX:null,mapY:null,imageUrl:null};
  assert.equal(postSchema.parse(base).scheduleType, "WEEKLY");
  assert.equal(postSchema.parse({...base,startDate:"2026-10-10"}).startDate,null);
  assert(!postSchema.safeParse({...base,scheduleType:"ONCE"}).success);
  assert(!postSchema.safeParse({...base,scheduleType:"ONCE",startDate:"2026-02-30"}).success);
  assert(!postSchema.safeParse({...base,scheduleType:"ONCE",startDate:"2026-10-10",finishDate:"2026-10-09"}).success);
  const once = postSchema.parse({...base,scheduleType:"ONCE",startDate:"2026-10-10",finishDate:"2026-10-10",weekdays:[1],seasons:["WINTER"]});
  assert.deepEqual(once.weekdays,[]);
  assert.deepEqual(once.seasons,[]);
  assert.equal(once.finishDate,"2026-10-10");
});
