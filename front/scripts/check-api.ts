import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { db } from "../src/lib/db";
const base = "http://localhost:28004";
const ids: string[] = [];
const posts: string[] = [];
let upload = "";
async function session(name: string) {
  const user = await db().user.create({ data: { nickname: name } });
  ids.push(user.id);
  const token = randomBytes(32).toString("hex");
  await db().session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  return { id: user.id, cookie: "village_session=" + token };
}
async function call(
  url: string,
  cookie = "",
  method = "GET",
  body?: unknown,
  origin = base,
) {
  const res = await fetch(base + "/api/" + url, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json(), cookie: res.headers.getSetCookie().map(c => c.split(";")[0]).join("; ") };
}
try {
  const login = await fetch(base + "/api/auth/kakao?next=%2Freport", {
    redirect: "manual",
  });
  assert.equal(login.status, 307);
  const loginCookies = login.headers.getSetCookie();
  assert(
    loginCookies.some((c) =>
      decodeURIComponent(c).startsWith("oauth_return=/report;"),
    ),
  );
  const callback = await fetch(base + "/api/auth/callback", {
    redirect: "manual",
    headers: { Cookie: loginCookies.map((c) => c.split(";")[0]).join("; ") },
  });
  assert.equal(callback.headers.get("location"), base + "/report?login=failed");
  const unsafeLogin = await fetch(
    base + "/api/auth/kakao?next=https://invalid.example",
    { redirect: "manual" },
  );
  assert(
    unsafeLogin.headers
      .getSetCookie()
      .some((c) => decodeURIComponent(c).startsWith("oauth_return=/my;")),
  );
  const a = await session("검증작성자"),
    b = await session("검증댓글러");
  assert.equal((await call("posts", "", "POST", {})).status, 401);
  assert.equal(
    (
      await call(
        "profile",
        a.cookie,
        "PATCH",
        { nickname: "변경" },
        "https://invalid.example",
      )
    ).status,
    403,
  );
  const input = {
    title: "API 검증 소식",
    body: "검증 후 자동 삭제됩니다.",
    category: "FOOD",
    place: "정문",
    mapX: null,
    mapY: null,
    latitude: 37.6,
    longitude: 126.8,
    imageUrl: null,
    endDate: null,
    endTime: null,
  };
  assert.equal(
    (
      await call("posts", a.cookie, "POST", {
        ...input,
        title: "가".repeat(16),
      })
    ).status,
    400,
  );
  const created = await call("posts", a.cookie, "POST", input);
  assert.equal(created.status, 201);
  const id = created.data.id;
  posts.push(id);
  assert.equal(
    (
      await call("profile", a.cookie, "PATCH", {
        nickname: "검증작성자",
        building: "2001동",
      })
    ).status,
    200,
  );
  assert.equal((await call("posts/" + id)).data.authorBuilding, "2001동");
  const original = (await call("posts/" + id)).data;
  assert.equal(
    (await call("posts/" + id, b.cookie, "PATCH", input)).status,
    403,
  );
  assert.equal(
    (
      await call("posts/" + id, a.cookie, "PATCH", {
        ...input,
        title: "수정된 소식",
      })
    ).status,
    200,
  );
  const edited = (await call("posts/" + id)).data;
  assert.equal(edited.title, "수정된 소식");
  assert.equal(edited.createdAt, original.createdAt);
  assert.equal(
    (
      await call("posts/" + id + "/comments", b.cookie, "POST", {
        body: "검증 댓글",
      })
    ).status,
    201,
  );
  const detail = await call("posts/" + id, b.cookie);
  assert.equal(detail.data.latitude, input.latitude);
  assert.equal(detail.data.longitude, input.longitude);
  assert.equal(detail.data.comments.length, 1);
  const commentId = detail.data.comments[0].id;
  assert.equal(
    (await call("comments/" + commentId, a.cookie, "DELETE", {})).status,
    403,
  );
  const activity = await call("activity?tab=posts", a.cookie);
  assert(
    activity.data.notifications.some(
      (n: { postId: string }) => n.postId === id,
    ),
  );
  await call("notifications", a.cookie, "PATCH", {});
  assert(
    (await call("bootstrap", a.cookie)).data.notifications.every(
      (n: { readAt: string }) => n.readAt,
    ),
  );
  await call("posts/" + id + "/like", b.cookie, "PUT", { liked: true });
  await call("posts/" + id + "/like", b.cookie, "PUT", { liked: true });
  assert.equal((await call("posts/" + id, b.cookie)).data.likes, 1);
  await call("posts/" + id + "/presence", b.cookie, "PUT", { state: "GONE" });
  assert.equal((await call("posts/" + id)).data.presence, "GONE");
  const guest = await call("bootstrap");
  assert.match(guest.cookie, /village_visitor=[a-f0-9]{64}/);
  assert.equal((await call("posts/" + id + "/presence", guest.cookie, "PUT", { state: "ARRIVED" }, "https://invalid.example")).status, 403);
  assert.equal((await call("posts/" + id + "/presence", guest.cookie, "PUT", { state: "ARRIVED" })).status, 200);
  assert.equal((await call("posts/" + id, guest.cookie)).data.presenceConfirmed, true);
  assert.equal((await call("posts/" + id)).data.presenceConfirmed, false);
  const refreshed = await call("bootstrap", guest.cookie);
  assert.equal(refreshed.data.posts.find((p: {id: string}) => p.id === id).presenceConfirmed, true);
  assert.equal((await call("posts/" + id + "/presence", guest.cookie, "PUT", { state: "GONE" })).status, 429);
  const visitorHash = createHash("sha256").update(guest.cookie.split("=")[1]).digest("hex");
  await db().visitorPresence.updateMany({where:{visitorHash},data:{observedAt:new Date(Date.now()-11000)}});
  assert.equal((await call("posts/" + id + "/presence", guest.cookie, "PUT", { state: "GONE" })).status, 200);
  assert.equal(await db().visitorPresence.count({where:{visitorHash,postId:id}}),1);
  assert.equal(
    (await call("comments/" + commentId, b.cookie, "DELETE", {})).status,
    200,
  );
  assert.equal((await call("posts/" + id)).data.commentCount, 0);
  console.log(
    "PASS OCI API: validation, auth, CSRF, posts, comments, owner protection, notifications, idempotent likes, presence",
  );
} finally {
  await db().post.deleteMany({ where: { id: { in: posts } } });
  await db().user.deleteMany({ where: { id: { in: ids } } });
  await db().$disconnect();
}
