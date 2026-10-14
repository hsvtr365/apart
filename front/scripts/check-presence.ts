// Uses a disposable database; never migrates or writes to the configured app database.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { db } from "../src/lib/db";
import {
  loginAccount,
  purgeExpiredAccountData,
  oneYearAfter,
  withdrawnNickname,
} from "../src/lib/account-retention";
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
  process.env.ABUSE_HMAC_SECRET =
    "isolated-test-secret-" + randomBytes(32).toString("hex");
  const env = { ...process.env, APP_URL: base, DEMO_MODE: "false" };
  const migration = spawn(process.execPath, ["scripts/migrate.cjs"], {
    env,
    stdio: "pipe",
    windowsHide: true,
  });
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
  const repeatMigration = spawn(process.execPath, ["scripts/migrate.cjs"], {
    env,
    stdio: "ignore",
    windowsHide: true,
  });
  assert.equal(
    (await once(repeatMigration, "exit"))[0],
    0,
    "Migration rerun must preserve initialized database",
  );
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
  const user = await db().user.create({
    data: { nickname: "확인하는이웃", kakaoId: "test-kakao-identity" },
  });
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
  const seoPage = async (
    path: string,
    cookie = "",
    agent = "OAI-SearchBot",
  ) => {
    const response = await fetch(base + path, {
      headers: { Cookie: cookie, "User-Agent": agent },
      redirect: "manual",
    });
    return { response, html: await response.text() };
  };
  for (const path of ["/", "/feed", "/feed/food", "/post/" + post.id]) {
    const { response, html } = await seoPage(path);
    assert.equal(response.status, 200, path);
    const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    assert(visible.includes(post.body), "Body must be in SSR HTML: " + path);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.equal(
      new URL(canonical ?? "", base).href,
      new URL(path, "https://apart.jujeop.com").href,
      path,
    );
    assert.match(
      response.headers.get("cache-control") ?? "",
      /private|no-store/,
    );
    assert.match(html, /<meta name="robots" content="index, follow[,\"]/);
    const structured = JSON.parse(
      html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )?.[1] ?? "null",
    );
    assert(
      structured?.["@graph"],
      "Missing server-rendered structured data: " + path,
    );
    if (path.startsWith("/post/")) {
      const article = structured["@graph"].find(
        (item: { "@type": string }) =>
          item["@type"] === "DiscussionForumPosting",
      );
      assert.equal(article.text, post.body);
      assert.equal(article.author.name, user.nickname);
      assert.equal(article.datePublished, post.createdAt.toISOString());
      assert.equal(article.dateModified, post.updatedAt.toISOString());
    }
  }
  const guide = await seoPage("/about");
  assert.equal(guide.response.status, 200);
  assert(
    guide.html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .includes("자주 묻는 질문"),
  );
  assert(
    (await seoPage("/sitemap.xml")).html.includes(
      "https://apart.jujeop.com/about",
    ),
  );
  const noticeFeed = await seoPage("/feed/notice");
  assert(
    !noticeFeed.html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .includes(post.body),
  );
  for (const agent of [
    "Mozilla/5.0",
    "Googlebot",
    "OAI-SearchBot",
    "bingbot",
    "Yeti",
  ]) {
    for (const path of [
      "/post/missing-seo-post",
      "/feed/wrong-category",
      "/my/extra",
    ]) {
      const { response, html } = await seoPage(path, "", agent);
      assert.equal(response.status, 404, agent + " " + path);
      assert.match(html, /name="robots" content="noindex"/);
    }
  }
  for (const path of ["/my", "/report", "/map/" + post.id]) {
    assert.match(
      (await seoPage(path)).html,
      /name="robots" content="noindex, follow"/,
    );
  }
  for (const [path, destination] of [
    ["/home", "/"],
    ["/feed/all", "/feed"],
  ]) {
    const { response } = await seoPage(path);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), destination);
  }
  assert.match(
    (await seoPage("/robots.txt")).html,
    /Sitemap: https:\/\/apart\.jujeop\.com\/sitemap.xml/,
  );
  assert((await seoPage("/sitemap.xml")).html.includes("/post/" + post.id));
  for (const flag of ["hidden", "adminDeleted", "userDeleted"] as const) {
    await db().post.update({ where: { id: post.id }, data: { [flag]: true } });
    const anonymous = await seoPage("/post/" + post.id);
    assert.equal(anonymous.response.status, 404, flag);
    assert(!anonymous.html.includes(post.body), "Private body leaked: " + flag);
    assert(
      !(await seoPage("/sitemap.xml")).html.includes("/post/" + post.id),
      flag,
    );
    if (flag !== "userDeleted") {
      const owner = await seoPage("/post/" + post.id, memberCookie);
      assert.equal(owner.response.status, 200, flag + " owner");
      assert.match(owner.html, /name="robots" content="noindex, follow"/);
      assert(
        !owner.html.includes('<script type="application/ld+json">'),
        "Private structured data leaked: " + flag,
      );
    }
    await db().post.update({ where: { id: post.id }, data: { [flag]: false } });
  }
  console.log(
    "PASS SSR content, canonical, crawler/browser 404, noindex, redirects, robots, live sitemap and private-post isolation",
  );
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
  const adminDeletedBefore = await db().post.findUnique({
    where: { id: post.id },
  });
  assert.equal((await call(url, memberCookie, "PATCH", {})).status, 403);
  assert.equal(
    (await call(url + "/like", memberCookie, "PUT", { liked: true })).status,
    403,
  );
  assert.equal(
    (await call(url + "/comments", memberCookie, "POST", { body: "차단" }))
      .status,
    403,
  );
  assert.deepEqual(
    await db().post.findUnique({ where: { id: post.id } }),
    adminDeletedBefore,
  );
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
  const deletedComment = await db().comment.create({
    data: { postId: post.id, authorId: user.id, body: "삭제 차단 검사" },
  });
  const before = await db().post.findUnique({ where: { id: post.id } });
  const eventsBefore = await db().presenceEvent.count({
    where: { postId: post.id },
  });
  assert.equal(
    (await call(url + "/like", memberCookie, "PUT", { liked: true })).status,
    404,
  );
  assert.equal(
    (await call(url + "/comments", memberCookie, "POST", { body: "차단" }))
      .status,
    404,
  );
  assert.equal(
    (await call("comments/" + deletedComment.id, memberCookie, "DELETE"))
      .status,
    403,
  );
  assert.equal((await call(url, memberCookie, "DELETE")).status, 404);
  assert.deepEqual(
    await db().post.findUnique({ where: { id: post.id } }),
    before,
  );
  assert.equal(
    await db().presenceEvent.count({ where: { postId: post.id } }),
    eventsBefore,
  );
  assert.equal(await db().comment.count({ where: { postId: post.id } }), 1);
  assert.equal(await db().like.count({ where: { postId: post.id } }), 0);

  const old = await db().post.create({
    data: {
      authorId: user.id,
      title: "오래된 오늘 장터",
      body: "최신 30개 밖의 유효 일정",
      category: "MARKET",
      latitude: 37.64,
      longitude: 126.83,
      createdAt: new Date("2020-01-01"),
      weekdays: [],
    },
  });
  await db().post.createMany({
    data: Array.from({ length: 35 }, (_, index) => ({
      authorId: user.id,
      title: "새 공고 " + index,
      body: "분류 검사",
      category: "NOTICE" as const,
    })),
  });
  const bootstrap = (await call("bootstrap")).data;
  assert.equal(bootstrap.posts.length, 30);
  assert(!bootstrap.posts.some((p: { id: string }) => p.id === old.id));
  assert(
    (await call("posts?category=MARKET")).data.posts.some(
      (p: { id: string }) => p.id === old.id,
    ),
  );
  assert(
    (await call("map-posts?today=true")).data.posts.some(
      (p: { id: string }) => p.id === old.id,
    ),
  );
  assert.equal((await call("posts/" + old.id)).status, 200);
  assert.equal((await call("posts?category=WRONG")).status, 400);
  assert.equal((await call("map-posts?today=WRONG")).status, 400);
  const notices = (await call("posts?category=NOTICE")).data;
  const nextNotices = (
    await call("posts?category=NOTICE&cursor=" + notices.nextCursor)
  ).data;
  assert.equal(notices.posts.length, 30);
  assert.equal(nextNotices.posts.length, 5);
  assert.equal(nextNotices.nextCursor, null);
  assert(
    nextNotices.posts.every(
      (p: { category: string }) => p.category === "NOTICE",
    ),
  );
  await db().post.createMany({
    data: Array.from({ length: 105 }, (_, index) => ({
      authorId: user.id,
      title: "지도 검사 " + index,
      body: "홈 카드 제한과 무관",
      category: "MARKET" as const,
      latitude: 37.64,
      longitude: 126.83,
      weekdays: [],
    })),
  });
  const mapFirst = (await call("map-posts?category=MARKET&today=true")).data;
  const mapNext = (
    await call(
      "map-posts?category=MARKET&today=true&cursor=" + mapFirst.nextCursor,
    )
  ).data;
  assert.equal(mapFirst.posts.length, 100);
  assert.equal(mapNext.posts.length, 6);
  assert.equal(mapNext.nextCursor, null);
  assert.equal(
    new Set([...mapFirst.posts, ...mapNext.posts].map((p) => p.id)).size,
    106,
  );
  await db().post.update({ where: { id: old.id }, data: { hidden: true } });
  assert(
    !(
      await call("map-posts?category=MARKET&cursor=" + mapFirst.nextCursor)
    ).data.posts.some((p: { id: string }) => p.id === old.id),
  );
  const historyPost = await db().post.create({
    data: {
      authorId: user.id,
      title: "기록 페이지 검사",
      body: "임시",
      category: "FOOD",
    },
  });
  const boundary = new Date(Date.now() - 28 * 86400000).toISOString();
  await db().presenceEvent.createMany({
    data: Array.from({ length: 64 }, (_, i) => ({
      postId: historyPost.id,
      visitorHash: hash,
      state: "ARRIVED" as const,
      occurrence: "WEEKLY:2026-09-01",
      observedAt: new Date(new Date(boundary).getTime() + (i - 31) * 1000),
    })),
  });
  const historyUrl = `posts/${historyPost.id}/presence-history?boundary=${encodeURIComponent(boundary)}`;
  const recentFirst = (await call(historyUrl + "&scope=recent")).data;
  const recentNext = (
    await call(historyUrl + "&scope=recent&cursor=" + recentFirst.nextCursor)
  ).data;
  assert.equal(recentFirst.logs.length, 30);
  assert.equal(recentNext.logs.length, 3);
  assert.equal(recentNext.nextCursor, null);
  assert.equal(recentNext.hasOlder, true);
  const olderFirst = (await call(historyUrl + "&scope=older")).data;
  const olderNext = (
    await call(historyUrl + "&scope=older&cursor=" + olderFirst.nextCursor)
  ).data;
  assert.equal(olderFirst.logs.length, 30);
  assert.equal(olderNext.logs.length, 1);
  assert.equal(olderNext.nextCursor, null);
  assert.equal(olderNext.hasOlder, false);
  assert.equal(
    new Set(
      [
        ...recentFirst.logs,
        ...recentNext.logs,
        ...olderFirst.logs,
        ...olderNext.logs,
      ].map((log) => log.id),
    ).size,
    64,
  );
  assert.equal(
    (await call(historyUrl + "&scope=older&cursor=" + recentFirst.logs[0].id))
      .status,
    400,
  );
  assert.equal(
    (
      await call(
        `posts/${historyPost.id}/presence-history?scope=recent&boundary=bad`,
      )
    ).status,
    400,
  );
  // Hold the same locks as withdrawal/deletion while an already-authenticated request waits.
  const raceUser = await db().user.create({ data: { nickname: "동시성검증" } });
  const raceToken = randomBytes(32).toString("hex");
  await db().session.create({
    data: {
      userId: raceUser.id,
      tokenHash: createHash("sha256").update(raceToken).digest("hex"),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const raceCookie = "village_session=" + raceToken;
  const blocker = new pg.Client({ connectionString: testUrl.toString() });
  await blocker.connect();
  async function waitForBlockedWrite() {
    for (let i = 0; i < 100; i++) {
      const waiting = await blocker.query(
        "SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())",
      );
      if (waiting.rowCount) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Write did not wait for the shared mutation lock");
  }
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "account:" + raceUser.id,
    ]);
    const pendingPost = call("posts", raceCookie, "POST", {
      title: "차단대상",
      body: "탈퇴 이후 저장 금지",
      category: "FOOD",
      mapX: null,
      mapY: null,
    });
    await waitForBlockedWrite();
    await blocker.query('UPDATE "User" SET "withdrawnAt"=now() WHERE id=$1', [
      raceUser.id,
    ]);
    await blocker.query("COMMIT");
    assert.equal((await pendingPost).status, 401);
    assert.equal(
      await db().post.count({ where: { authorId: raceUser.id } }),
      0,
    );
    await blocker.query("BEGIN");
    await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "post:" + historyPost.id,
    ]);
    const pendingComment = call(
      `posts/${historyPost.id}/comments`,
      memberCookie,
      "POST",
      { body: "삭제 이후 저장 금지" },
    );
    await waitForBlockedWrite();
    await blocker.query('UPDATE "Post" SET "adminDeleted"=true WHERE id=$1', [
      historyPost.id,
    ]);
    await blocker.query("COMMIT");
    assert.equal((await pendingComment).status, 403);
    assert.equal(
      await db().comment.count({ where: { postId: historyPost.id } }),
      0,
    );
    await db().post.update({
      where: { id: historyPost.id },
      data: { adminDeleted: false },
    });
  } finally {
    await blocker.query("ROLLBACK");
    await blocker.end();
  }
  console.log(
    "PASS empty database migration + rerun; withdrawal/deletion blocked in-flight writes",
  );
  assert.equal(
    (await call("account", "", "DELETE", { confirm: true })).status,
    401,
  );
  assert.equal(
    (await call("account", memberCookie, "DELETE", { confirm: false })).status,
    400,
  );
  await db().like.create({ data: { userId: user.id, postId: old.id } });
  const authoredBefore = await db().post.count({
    where: { authorId: user.id },
  });
  const commentsBefore = await db().comment.count({
    where: { authorId: user.id },
  });
  assert.equal(
    (await call("account", memberCookie, "DELETE", { confirm: true })).status,
    200,
  );
  const retired = await db().user.findUniqueOrThrow({ where: { id: user.id } });
  assert(retired.withdrawnAt);
  assert.equal(retired.kakaoId, null);
  assert.equal(retired.nickname, withdrawnNickname(user.id));
  assert.equal(retired.building, null);
  assert.equal(await db().session.count({ where: { userId: user.id } }), 0);
  assert.equal(await db().like.count({ where: { userId: user.id } }), 1);
  assert.equal(
    await db().post.count({ where: { authorId: user.id } }),
    authoredBefore,
  );
  assert.equal(
    await db().comment.count({ where: { authorId: user.id } }),
    commentsBefore,
  );
  assert.equal((await call("bootstrap", memberCookie)).data.user, null);
  assert.equal(
    (await call(`posts/${historyPost.id}`)).data.author,
    withdrawnNickname(user.id),
  );
  const joined = await Promise.all([
    loginAccount("test-kakao-identity"),
    loginAccount("test-kakao-identity"),
  ]);
  assert.equal(joined[0].id, joined[1].id);
  const rejoined = joined[0];
  assert.notEqual(rejoined.id, user.id);
  assert.equal(rejoined.abuseIdentityId, retired.abuseIdentityId);
  const sessionToken = randomBytes(32).toString("hex");
  await db().session.create({
    data: {
      userId: rejoined.id,
      tokenHash: createHash("sha256").update(sessionToken).digest("hex"),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const rejoinedCookie = "village_session=" + sessionToken;
  assert.equal(
    (await call("account-audit?userId=" + rejoined.id, rejoinedCookie)).status,
    403,
  );
  await db().user.update({
    where: { id: rejoined.id },
    data: { permission: 0 },
  });
  const audit = await call(
    "account-audit?userId=" + rejoined.id,
    rejoinedCookie,
  );
  assert.equal(audit.status, 200);
  assert.equal(audit.data.accounts.length, 2);
  assert(!JSON.stringify(audit.data).includes(retired.abuseIdentityId!));
  await db().user.update({
    where: { id: rejoined.id },
    data: { permission: 1 },
  });
  await db().post.update({ where: { id: old.id }, data: { hidden: false } });
  const attempts = await Promise.all([
    call(`posts/${old.id}/like`, rejoinedCookie, "PUT", { liked: true }),
    call(`posts/${old.id}/like`, rejoinedCookie, "PUT", { liked: true }),
  ]);
  assert.deepEqual(
    attempts.map((r) => r.status),
    [409, 409],
  );
  assert.equal(await db().like.count({ where: { postId: old.id } }), 1);
  assert.equal(
    await db().accountSecurityEvent.count({
      where: { userId: rejoined.id, reason: "DUPLICATE_LIKE" },
    }),
    2,
  );
  assert.equal(
    (
      await call("profile", rejoinedCookie, "PATCH", {
        nickname: "새 닉네임",
        building: "2001동",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("profile", rejoinedCookie, "PATCH", {
        nickname: "새 닉네임",
        building: "2002동",
      })
    ).status,
    200,
  );
  assert.equal(
    await db().nicknameChangeLog.count({
      where: { userId: rejoined.id, reason: "USER_EDIT" },
    }),
    1,
  );
  await db().nicknameChangeLog.updateMany({
    where: { userId: user.id },
    data: { expiresAt: new Date(0) },
  });
  await db().user.update({
    where: { id: user.id },
    data: { abuseLinkExpiresAt: new Date(0) },
  });
  assert.equal(
    (await call(`posts/${old.id}/like`, rejoinedCookie, "PUT", { liked: true }))
      .status,
    200,
    "Expired identity link must detach before the daily cleanup",
  );
  await purgeExpiredAccountData();
  assert.equal(
    await db().nicknameChangeLog.count({ where: { userId: user.id } }),
    0,
  );
  assert.equal(
    (await db().user.findUniqueOrThrow({ where: { id: user.id } }))
      .abuseIdentityId,
    null,
  );
  assert.equal(
    (
      await db().like.findUniqueOrThrow({
        where: { userId_postId: { userId: user.id, postId: old.id } },
      })
    ).abuseIdentityId,
    null,
  );
  assert.equal(
    (await call("account", rejoinedCookie, "DELETE", { confirm: true })).status,
    200,
  );
  const scrubbed = await db().nicknameChangeLog.findMany({
    where: { userId: rejoined.id },
  });
  assert(
    scrubbed.every(
      (log) =>
        !log.before &&
        (!log.after || log.after === withdrawnNickname(rejoined.id)),
    ),
  );
  await db().abuseIdentity.updateMany({ data: { expiresAt: new Date(0) } });
  await purgeExpiredAccountData();
  assert.equal(await db().abuseIdentity.count(), 0);
  assert.equal(await db().accountSecurityEvent.count(), 0);
  assert.equal(await db().like.count({ where: { userId: user.id } }), 1);
  assert.equal(
    oneYearAfter(new Date("2024-02-29T00:00:00Z")).toISOString(),
    "2025-02-28T00:00:00.000Z",
  );
  console.log(
    "PASS retained withdrawal, identity-based concurrent duplicate likes, profile audit, nickname scrub and expiry cleanup",
  );
  console.log(
    "PASS four-week history boundary, recent/older cursors, 64 distinct records and invalid cursor rejection",
  );
  console.log(
    "PASS remaining section 3: deleted mutations unchanged, category cursors, old selected map post, 106 map entries independent of home cards",
  );
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
