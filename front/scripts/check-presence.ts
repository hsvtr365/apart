// Uses a disposable database; never migrates or writes to the configured app database.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { db } from "../src/lib/db";
import { presenceOccurrence, visitorAlias } from "../src/lib/presence";

const originalUrl = process.env.DATABASE_URL;
assert(originalUrl, "DATABASE_URL is required");
const databaseName = "village_presence_test_" + randomBytes(6).toString("hex");
const admin = new pg.Client({
  connectionString: originalUrl,
  connectionTimeoutMillis: 5000,
});
const testUrl = new URL(originalUrl);
testUrl.pathname = "/" + databaseName;
const base = "http://localhost:28114";
let server: ReturnType<typeof spawn> | undefined;
let created = false;
async function call(
  route: string,
  cookie = "",
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(base + "/api/" + route, {
    method,
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  };
}
try {
  await admin.connect();
  await admin.query('CREATE DATABASE "' + databaseName + '"');
  created = true;
  process.env.DATABASE_URL = testUrl.toString();
  const env = { ...process.env, APP_URL: base, DEMO_MODE: "false" };
  // Historical migrations have an unrelated fresh-install ordering issue. Bootstrap
  // only this disposable database, then execute the new migration independently.
  const migration = spawn(
    process.execPath,
    ["node_modules/prisma/build/index.js", "db", "push"],
    { env, stdio: "pipe", windowsHide: true },
  );
  let migrationOutput = "";
  migration.stdout?.on("data", (chunk) => {
    migrationOutput += chunk;
  });
  migration.stderr?.on("data", (chunk) => {
    migrationOutput += chunk;
  });
  const migrationExit = (await once(migration, "exit"))[0];
  if (migrationExit !== 0)
    console.error(
      migrationOutput
        .replaceAll(testUrl.toString(), "[test database]")
        .replace(/postgres(?:ql)?:\/\/\S+/g, "[database URL]"),
    );
  assert.equal(migrationExit, 0, "Disposable database migrations failed");
  const setup = new pg.Client({ connectionString: testUrl.toString() });
  await setup.connect();
  try {
    await setup.query('DROP TABLE "PresenceEvent"');
    await setup.query(
      'ALTER TABLE "Presence" DROP COLUMN "occurrence"; ALTER TABLE "VisitorPresence" DROP COLUMN "occurrence"',
    );
    await setup.query(
      await readFile(
        "prisma/migrations/202610120001_presence_events/migration.sql",
        "utf8",
      ),
    );
  } finally {
    await setup.end();
  }
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "28114",
    ],
    { env, stdio: "pipe", windowsHide: true },
  );
  server.stdout?.resume();
  server.stderr?.resume();
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      ready = (await call("health")).status === 200;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, "Isolated test server did not start");
  const user = await db().user.create({ data: { nickname: "확인하는이웃" } });
  const token = randomBytes(32).toString("hex");
  await db().session.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const memberCookie = "village_session=" + token;
  const post = await db().post.create({
    data: {
      authorId: user.id,
      title: "회차 검증",
      body: "임시 DB 검사",
      category: "FOOD",
      weekdays: [],
    },
  });
  const url = "posts/" + post.id;
  const visitor = (await call("bootstrap")).cookie;
  const hash = createHash("sha256").update(visitor.split("=")[1]).digest("hex");
  assert.equal(
    (await call(url + "/presence", visitor, "PUT", { state: "ARRIVED" }))
      .status,
    200,
  );
  assert.equal((await call(url, visitor)).data.presenceConfirmed, true);
  const first = await call(url + "/presence-history");
  assert.equal(first.data.logs.length, 1);
  assert.equal(first.data.logs[0].nickname, visitorAlias(hash));
  assert.equal(first.data.logs[0].state, "ARRIVED");
  assert(!JSON.stringify(first.data).includes(hash));
  assert(!JSON.stringify(first.data).includes(user.id));
  assert.equal(
    (await call(url + "/presence", visitor, "PUT", { state: "GONE" })).status,
    429,
  );
  await db().visitorPresence.updateMany({
    where: { visitorHash: hash },
    data: { observedAt: new Date(Date.now() - 11000) },
  });
  assert.equal(
    (await call(url + "/presence", visitor, "PUT", { state: "GONE" })).status,
    200,
  );
  const second = (await call(url + "/presence-history")).data.logs;
  assert.equal(second.length, 2);
  assert.deepEqual(
    second.map((log: { state: string }) => log.state),
    ["GONE", "ARRIVED"],
  );
  assert.equal(second[0].nickname, second[1].nickname);
  assert.equal(
    (await call(url + "/presence", memberCookie, "PUT", { state: "ARRIVED" }))
      .status,
    200,
  );
  assert.equal(
    (await call(url + "/presence-history")).data.logs[0].nickname,
    user.nickname,
  );
  assert.equal(
    await db().presenceEvent.count({ where: { postId: post.id } }),
    3,
    "Member click must create one log",
  );

  const previous = new Date(Date.now() - 7 * 86400000);
  await db().presenceEvent.updateMany({
    where: { postId: post.id },
    data: {
      observedAt: previous,
      occurrence: presenceOccurrence(post, previous),
    },
  });
  await db().presence.updateMany({
    where: { postId: post.id },
    data: {
      observedAt: previous,
      occurrence: presenceOccurrence(post, previous),
    },
  });
  await db().visitorPresence.updateMany({
    where: { postId: post.id },
    data: {
      observedAt: previous,
      occurrence: presenceOccurrence(post, previous),
    },
  });
  const nextVisit = await call(url, visitor);
  assert.equal(nextVisit.data.presenceConfirmed, false);
  assert.equal(nextVisit.data.presence, null);
  assert.equal(nextVisit.data.observedAt, null);
  assert.equal((await call(url + "/presence-history")).data.logs.length, 0);
  assert.equal(
    (await call(url + "/presence-history?scope=all")).data.logs.length,
    3,
  );

  await db().presenceEvent.createMany({
    data: Array.from({ length: 32 }, (_, i) => ({
      postId: post.id,
      visitorHash: hash,
      occurrence: presenceOccurrence(post),
      state: "ARRIVED" as const,
      observedAt: new Date(Date.now() - i * 1000),
    })),
  });
  const page = (await call(url + "/presence-history")).data;
  assert.equal(page.logs.length, 30);
  const tail = (await call(url + "/presence-history?cursor=" + page.nextCursor))
    .data;
  assert.equal(tail.logs.length, 2);
  assert.equal(
    new Set([...page.logs, ...tail.logs].map((log) => log.id)).size,
    32,
  );
  const raceGuest = (await call("bootstrap")).cookie;
  const race = await Promise.all([
    call(url + "/presence", raceGuest, "PUT", { state: "ARRIVED" }),
    call(url + "/presence", raceGuest, "PUT", { state: "GONE" }),
  ]);
  assert.deepEqual(race.map((result) => result.status).sort(), [200, 429]);
  const oncePost = await db().post.create({
    data: {
      authorId: user.id,
      title: "1회 검증",
      body: "임시 일정",
      category: "FOOD",
      scheduleType: "ONCE",
      startDate: "2026-10-12",
      finishDate: "2026-10-14",
    },
  });
  const onceGuest = (await call("bootstrap")).cookie;
  assert.equal(
    (
      await call("posts/" + oncePost.id + "/presence", onceGuest, "PUT", {
        state: "ARRIVED",
      })
    ).status,
    200,
  );
  await db().post.update({
    where: { id: oncePost.id },
    data: { startDate: "2026-10-20", finishDate: "2026-10-21" },
  });
  const changed = (await call("posts/" + oncePost.id, onceGuest)).data;
  assert.equal(changed.presenceConfirmed, false);
  assert.equal(changed.presence, null);
  assert.equal(changed.lastPresenceReport.state, "ARRIVED");
  assert.equal(
    (await call("posts/" + oncePost.id + "/presence-history")).data.logs.length,
    0,
  );
  assert.equal(
    (await call("posts/" + oncePost.id + "/presence-history?scope=all")).data
      .logs.length,
    1,
  );
  await db().post.update({ where: { id: post.id }, data: { hidden: true } });
  assert.equal((await call(url + "/presence-history")).status, 404);
  assert.equal(
    (await call(url + "/presence-history", memberCookie)).status,
    200,
  );
  assert.equal(
    (await call(url + "/presence", visitor, "PUT", { state: "ARRIVED" }))
      .status,
    404,
  );
  await db().post.update({
    where: { id: post.id },
    data: { hidden: false, adminDeleted: true },
  });
  assert.equal(
    (await call(url + "/presence-history", memberCookie)).status,
    404,
  );
  const adminDeletedBefore = await db().post.findUnique({ where: { id: post.id } });
  assert.equal((await call(url, memberCookie, "PATCH", {})).status, 403);
  assert.equal((await call(url + "/like", memberCookie, "PUT", { liked: true })).status, 403);
  assert.equal((await call(url + "/comments", memberCookie, "POST", { body: "차단" })).status, 403);
  assert.deepEqual(await db().post.findUnique({ where: { id: post.id } }), adminDeletedBefore);
  await db().post.update({
    where: { id: post.id },
    data: { adminDeleted: false, userDeleted: true },
  });
  assert.equal(
    (await call(url + "/presence-history", memberCookie)).status,
    404,
  );
  assert.equal(
    (await call(url + "/presence", visitor, "PUT", { state: "ARRIVED" }))
      .status,
    404,
  );
  assert.equal((await call(url, memberCookie, "PATCH", {})).status, 404);
  const deletedComment = await db().comment.create({ data: { postId: post.id, authorId: user.id, body: "삭제 차단 검사" } });
  const before = await db().post.findUnique({ where: { id: post.id } });
  const eventsBefore = await db().presenceEvent.count({ where: { postId: post.id } });
  assert.equal((await call(url + "/like", memberCookie, "PUT", { liked: true })).status, 404);
  assert.equal((await call(url + "/comments", memberCookie, "POST", { body: "차단" })).status, 404);
  assert.equal((await call("comments/" + deletedComment.id, memberCookie, "DELETE")).status, 403);
  assert.equal((await call(url, memberCookie, "DELETE")).status, 404);
  assert.deepEqual(await db().post.findUnique({ where: { id: post.id } }), before);
  assert.equal(await db().presenceEvent.count({ where: { postId: post.id } }), eventsBefore);
  assert.equal(await db().comment.count({ where: { postId: post.id } }), 1);
  assert.equal(await db().like.count({ where: { postId: post.id } }), 0);

  const old = await db().post.create({ data: {
    authorId: user.id, title: "오래된 오늘 장터", body: "최신 30개 밖의 유효 일정", category: "MARKET",
    latitude: 37.64, longitude: 126.83, createdAt: new Date("2020-01-01"), weekdays: [],
  } });
  await db().post.createMany({ data: Array.from({ length: 35 }, (_, index) => ({
    authorId: user.id, title: "새 공고 " + index, body: "분류 검사", category: "NOTICE" as const,
  })) });
  const bootstrap = (await call("bootstrap")).data;
  assert.equal(bootstrap.posts.length, 30);
  assert(!bootstrap.posts.some((p: { id: string }) => p.id === old.id));
  assert((await call("posts?category=MARKET")).data.posts.some((p: { id: string }) => p.id === old.id));
  assert((await call("map-posts?today=true")).data.posts.some((p: { id: string }) => p.id === old.id));
  assert.equal((await call("posts/" + old.id)).status, 200);
  assert.equal((await call("posts?category=WRONG")).status, 400);
  assert.equal((await call("map-posts?today=WRONG")).status, 400);
  const notices = (await call("posts?category=NOTICE")).data;
  const nextNotices = (await call("posts?category=NOTICE&cursor=" + notices.nextCursor)).data;
  assert.equal(notices.posts.length, 30);
  assert.equal(nextNotices.posts.length, 5);
  assert.equal(nextNotices.nextCursor, null);
  assert(nextNotices.posts.every((p: { category: string }) => p.category === "NOTICE"));
  await db().post.createMany({ data: Array.from({ length: 105 }, (_, index) => ({
    authorId: user.id, title: "지도 검사 " + index, body: "홈 카드 제한과 무관", category: "MARKET" as const,
    latitude: 37.64, longitude: 126.83, weekdays: [],
  })) });
  const mapFirst = (await call("map-posts?category=MARKET&today=true")).data;
  const mapNext = (await call("map-posts?category=MARKET&today=true&cursor=" + mapFirst.nextCursor)).data;
  assert.equal(mapFirst.posts.length, 100);
  assert.equal(mapNext.posts.length, 6);
  assert.equal(mapNext.nextCursor, null);
  assert.equal(new Set([...mapFirst.posts, ...mapNext.posts].map(p => p.id)).size, 106);
  await db().post.update({ where: { id: old.id }, data: { hidden: true } });
  assert(!(await call("map-posts?category=MARKET&cursor=" + mapFirst.nextCursor)).data.posts.some((p: { id: string }) => p.id === old.id));
  console.log("PASS remaining section 3: deleted mutations unchanged, category cursors, old selected map post, 106 map entries independent of home cards");
  console.log(
    "PASS isolated DB/API: logs, guest aliases, member names, privacy, cooldown, visit reset, pagination, permissions",
  );
} finally {
  if (server && server.exitCode === null) {
    const stopped = once(server, "exit");
    server.kill();
    await stopped;
  }
  await db().$disconnect();
  if (created)
    await admin.query('DROP DATABASE "' + databaseName + '" WITH (FORCE)');
  await admin.end();
  process.env.DATABASE_URL = originalUrl;
}
