import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  currentUser,
  hash,
  startSession,
  origin,
  cookieOptions,
} from "@/lib/auth";
import {
  postSchema,
  profileSchema,
  commentSchema,
} from "@/lib/validation";
import { getPosts, getTodayPosts, comments, notifications } from "@/lib/queries";
import { demoData } from "@/lib/demo";
import { visitorHash } from "@/lib/visitor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
async function body(req: NextRequest) {
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 16_000)
    throw new HttpError("입력 내용이 너무 큽니다.", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError("입력 형식을 확인해주세요.");
  }
}
// Single web instance MVP. Move this bound limiter to shared storage if web replicas are added.
const buckets = new Map<string, { count: number; until: number }>();
function limit(key: string, maximum = 60) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  }
  const value = buckets.get(key);
  if (value && value.until > now) {
    if (++value.count > maximum)
      throw new HttpError("잠시 후 다시 시도해주세요.", 429);
  } else buckets.set(key, { count: 1, until: now + 60_000 });
}
function equal(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  try {
    const parts = (await ctx.params).path ?? [];
    const [resource, id, action] = parts;
    const method = req.method;
    const demo = process.env.DEMO_MODE === "true";
    if (resource === "health")
      return json({ ok: true, mode: demo ? "demo" : "live" });
    if (resource === "bootstrap" && method === "GET") {
      if (demo) return json(demoData());
      await visitorHash(true);
      const user = await currentUser();
      return json({
        mode: "live",
        user: user
          ? { id: user.id, nickname: user.nickname, building: user.building, permission: user.permission }
          : null,
        ...(await getPosts(user?.id)),
        todayPosts: await getTodayPosts(user?.id),
        notifications: user ? await notifications(user.id) : [],
        kakaoReady: !!process.env.KAKAO_CLIENT_ID,
      });
    }
    if (demo)
      throw new HttpError("데모 모드에서는 서버에 저장하지 않습니다.", 409);
    if (resource === "collector" && method === "POST") {
      const secret = process.env.COLLECTOR_TOKEN;
      const token =
        req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      if (!secret || secret.length < 32 || !equal(secret, token))
        throw new HttpError("수집 서버 인증이 필요합니다.", 401);
      const input = z
        .object({
          source: z.string().min(1).max(80),
          externalId: z.string().min(1).max(200),
          sourceUrl: z.url().refine((v) => new URL(v).protocol === "https:"),
          title: z.string().min(1).max(200),
          body: z.string().max(5000),
        })
        .parse(await body(req));
      const candidate = await db().collectionCandidate.upsert({
        where: {
          source_externalId: {
            source: input.source,
            externalId: input.externalId,
          },
        },
        create: input,
        update: {},
      });
      return json({ id: candidate.id, status: "pending-review" }, 201);
    }
    if (resource === "auth" && id === "kakao" && method === "GET") {
      if (!process.env.KAKAO_CLIENT_ID)
        throw new HttpError("카카오 로그인 설정이 필요합니다.", 503);
      const state = randomBytes(32).toString("hex");
      const jar = await cookies();
      jar.set(
        "oauth_return",
        req.nextUrl.searchParams.get("next") === "/report" ? "/report" : "/my",
        { ...cookieOptions(), maxAge: 600 },
      );
      jar.set("oauth_state", state, {
        ...cookieOptions(),
        maxAge: 600,
      });
      const url = new URL("https://kauth.kakao.com/oauth/authorize");
      url.search = new URLSearchParams({
        client_id: process.env.KAKAO_CLIENT_ID,
        redirect_uri: origin() + "/api/auth/callback",
        response_type: "code",
        state,
      }).toString();
      return NextResponse.redirect(url);
    }
    if (resource === "auth" && id === "callback" && method === "GET") {
      const jar = await cookies();
      const expected = jar.get("oauth_state")?.value;
      const destination =
        jar.get("oauth_return")?.value === "/report" ? "/report" : "/my";
      jar.delete("oauth_state");
      jar.delete("oauth_return");
      try {
        const state = req.nextUrl.searchParams.get("state");
        const code = req.nextUrl.searchParams.get("code");
        if (!expected || !state || !equal(expected, state) || !code)
          throw new Error("Invalid OAuth state");
        const response = await fetch("https://kauth.kakao.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.KAKAO_CLIENT_ID!,
            redirect_uri: origin() + "/api/auth/callback",
            code,
            ...(process.env.KAKAO_CLIENT_SECRET
              ? { client_secret: process.env.KAKAO_CLIENT_SECRET }
              : {}),
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("Token exchange failed");
        const token = await response.json();
        const profile = await fetch("https://kapi.kakao.com/v2/user/me", {
          headers: { Authorization: "Bearer " + token.access_token },
          signal: AbortSignal.timeout(10000),
        });
        if (!profile.ok) throw new Error("Profile failed");
        const kakao = await profile.json();
        if (!kakao.id) throw new Error("Missing user id");
        const user = await db().user.upsert({
          where: { kakaoId: String(kakao.id) },
          create: {
            kakaoId: String(kakao.id),
            nickname: "이웃" + randomBytes(3).toString("hex"),
          },
          update: {},
        });
        await startSession(user.id);
        return NextResponse.redirect(origin() + destination);
      } catch {
        return NextResponse.redirect(origin() + destination + "?login=failed");
      }
    }
    if (resource === "uploads" && id && method === "GET") {
      if (!/^[a-f0-9-]+\.webp$/.test(id))
        throw new HttpError("사진을 찾을 수 없습니다.", 404);
      const bytes = await readFile(
        /* turbopackIgnore: true */ path.join(
          /* turbopackIgnore: true */ process.env.UPLOAD_DIR ||
            "./data/uploads",
          id,
        ),
      ).catch(() => null);
      if (!bytes) throw new HttpError("사진을 찾을 수 없습니다.", 404);
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const user = await currentUser();
    if (method === "GET") {
      if (resource === "posts" && !id)
        return json(
          await getPosts(
            user?.id,
            req.nextUrl.searchParams.get("cursor") ?? undefined,
          ),
        );
      if (resource === "posts" && id) {
        const p = (await getPosts(user?.id, undefined, { id }, 1, true)).posts[0];
        if (!p) throw new HttpError("삭제되었거나 없는 글입니다.", 404);
        if ((p.hidden || p.adminDeleted) && p.authorId !== user?.id && user?.permission !== 0)
          throw new HttpError("숨겨진 글입니다.", 404);
        return json({
          ...p,
          ...(await comments(
            id,
            req.nextUrl.searchParams.get("cursor") ?? undefined,
          )),
        });
      }
      if (resource === "activity") {
        if (!user) throw new HttpError("로그인해주세요.", 401);
        const tab = req.nextUrl.searchParams.get("tab");
        const where =
          tab === "liked"
            ? { likes: { some: { userId: user.id } } }
            : tab === "comments"
              ? { comments: { some: { authorId: user.id } } }
              : { authorId: user.id };
        const result = await getPosts(
          user.id,
          req.nextUrl.searchParams.get("cursor") ?? undefined,
          where,
          30,
          tab !== "liked" && tab !== "comments",
        );
        if (tab === "comments")
          for (const p of result.posts) {
            const own = await db().comment.findMany({
              where: { postId: p.id, authorId: user.id },
              orderBy: { createdAt: "desc" },
            });
            p.comments = own.map((c) => ({
              id: c.id,
              body: c.body,
              authorId: user.id,
              author: user.nickname,
              createdAt: c.createdAt.toISOString(),
            }));
          }
        return json({ ...result, notifications: await notifications(user.id) });
      }
      throw new HttpError("없는 경로입니다.", 404);
    }
    if (req.headers.get("origin") !== origin())
      throw new HttpError("요청 출처를 확인할 수 없습니다.", 403);
    if (resource === "posts" && id && action === "presence" && method === "PUT") {
      const visitor = (await visitorHash(true))!;
      limit("presence:" + visitor, 10);
      // Nginx overwrites X-Real-IP. This loose limit may cover a shared proxy/IP.
      const ip = req.headers.get("x-real-ip");
      if (ip) limit("presence-ip:" + hash(ip), 300);
      const { state } = z.object({ state: z.enum(["ARRIVED", "GONE"]) }).parse(await body(req));
      const post = await db().post.findUnique({ where: { id } });
      if (!post || post.hidden || post.adminDeleted) throw new HttpError("삭제되었거나 숨겨진 글입니다.", 404);
      if (post.category !== "FOOD") throw new HttpError("먹거리 소식만 현장 확인할 수 있습니다.");
      await db().$transaction(async tx => {
        // Serialize the visitor's requests so concurrent clicks cannot bypass the cooldown.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${visitor}))`;
        const recent = await tx.visitorPresence.findFirst({
          where: { visitorHash: visitor }, orderBy: { observedAt: "desc" },
        });
        if (recent && Date.now() - recent.observedAt.getTime() < 10_000)
          throw new HttpError("10초 후 다시 확인해주세요.", 429);
        await tx.visitorPresence.upsert({
          where: { visitorHash_postId: { visitorHash: visitor, postId: id } },
          create: { visitorHash: visitor, postId: id, state },
          update: { state, observedAt: new Date() },
        });
        if (user) await tx.presence.upsert({
          where: { userId_postId: { userId: user.id, postId: id } },
          create: { userId: user.id, postId: id, state },
          update: { state, observedAt: new Date() },
        });
      });
      return json({ ok: true });
    }
    if (!user) throw new HttpError("로그인 후 이용해주세요.", 401);
    limit(user.id);
    if (resource === "auth" && id === "logout" && method === "POST") {
      const jar = await cookies();
      const token = jar.get("village_session")?.value;
      if (token)
        await db().session.deleteMany({ where: { tokenHash: hash(token) } });
      jar.delete("village_session");
      return json({ ok: true });
    }
    if (resource === "profile" && method === "PATCH") {
      const input = profileSchema.parse(await body(req));
      const updated = await db().user.update({
        where: { id: user.id },
        data: input,
        select: { id: true, nickname: true, building: true, permission: true },
      });
      return json(updated);
    }
    if (resource === "notifications" && method === "PATCH") {
      const input = z
        .object({ id: z.string().optional() })
        .parse(await body(req));
      await db().notification.updateMany({
        where: { userId: user.id, ...(input.id ? { id: input.id } : {}) },
        data: { readAt: new Date() },
      });
      return json({ ok: true });
    }
    if (resource === "uploads" && method === "POST") {
      if (Number(req.headers.get("content-length") || 0) > 9 * 1024 * 1024)
        throw new HttpError("8MB 이하의 사진을 선택해주세요.", 413);
      const file = (await req.formData()).get("file");
      if (
        !(file instanceof File) ||
        file.size > 8 * 1024 * 1024 ||
        file.size === 0
      )
        throw new HttpError("8MB 이하의 사진을 선택해주세요.");
      let image: Buffer;
      try {
        image = await sharp(Buffer.from(await file.arrayBuffer()), {
          limitInputPixels: 25_000_000,
        })
          .rotate()
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
      } catch {
        throw new HttpError("지원하는 사진 파일을 선택해주세요.");
      }
      const name = randomBytes(16).toString("hex") + ".webp";
      const dir = process.env.UPLOAD_DIR || "./data/uploads";
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), image);
      await db().upload.create({ data: { id: name, userId: user.id } });
      return json({ url: "/api/uploads/" + name }, 201);
    }
    if (
      resource === "posts" &&
      ((!id && method === "POST") || (id && !action && method === "PATCH"))
    ) {
      const existing = id
        ? await db().post.findUnique({ where: { id }, include: { images: true } })
        : null;
      if (id && !existing)
        throw new HttpError("삭제되었거나 없는 글입니다.", 404);
      if (existing && existing.authorId !== user.id && user.permission !== 0)
        throw new HttpError("본인 글만 수정할 수 있어요.", 403);
      if (existing?.adminDeleted)
        throw new HttpError("관리자가 삭제처리한 글은 수정할 수 없습니다.", 403);
      const input = postSchema.parse(await body(req));
      const { imageUrl, imageUrls, ...fields } = input;
      const urls = imageUrls ?? (imageUrl ? [imageUrl] : []);
      const added = urls.filter(url => !existing?.images.some(image => image.url === url));
      const uploads = await db().upload.findMany({
        where: { id: { in: added.map(url => url.split("/").at(-1)!) }, userId: user.id },
        select: { id: true },
      });
      if (uploads.length !== added.length)
        throw new HttpError("직접 업로드한 사진을 선택해주세요.");
      if (existing) {
        await db().post.update({
          where: { id: existing.id },
          data: { ...fields, images: { deleteMany: {}, create: urls.map((url, position) => ({ url, position })) } },
        });
        return json({ id: existing.id });
      }
      const post = await db().post.create({
        data: { ...fields, authorId: user.id, images: { create: urls.map((url, position) => ({ url, position })) } },
      });
      return json({ id: post.id }, 201);
    }
    if (resource === "posts" && id) {
      const post = await db().post.findUnique({ where: { id } });
      if (!post) throw new HttpError("삭제되었거나 없는 글입니다.", 404);
      if (method === "DELETE") {
        if (post.authorId !== user.id) throw new HttpError("본인 글만 삭제할 수 있어요.", 403);
        if (post.adminDeleted) throw new HttpError("관리자가 삭제처리한 글은 직접 삭제할 수 없습니다.", 403);
        await db().post.update({ where: { id }, data: { userDeleted: true } });
        return json({ ok: true });
      }
      if (post.userDeleted) throw new HttpError("이미 삭제한 글입니다.", 404);
      if (action === "admin-delete" && method === "PATCH") {
        if (user.permission !== 0) throw new HttpError("관리자 권한이 필요합니다.", 403);
        await db().post.update({ where: { id }, data: { adminDeleted: true } });
        return json({ ok: true });
      }
      if (post.adminDeleted) throw new HttpError("관리자가 삭제처리한 글은 변경할 수 없습니다.", 403);
      if (post.hidden && post.authorId !== user.id && user.permission !== 0)
        throw new HttpError("숨겨진 글입니다.", 404);
      if (action === "comments" && method === "POST") {
        const input = commentSchema.parse(await body(req));
        await db().$transaction(async (tx) => {
          const c = await tx.comment.create({
            data: { postId: id, authorId: user.id, ...input },
          });
          if (post.authorId !== user.id)
            await tx.notification.create({
              data: { userId: post.authorId, postId: id, commentId: c.id },
            });
        });
        return json({ ok: true }, 201);
      }
      if (action === "like" && method === "PUT") {
        const { liked } = z
          .object({ liked: z.boolean() })
          .parse(await body(req));
        if (liked)
          await db().like.upsert({
            where: { userId_postId: { userId: user.id, postId: id } },
            create: { userId: user.id, postId: id },
            update: {},
          });
        else
          await db().like.deleteMany({
            where: { userId: user.id, postId: id },
          });
        return json({ ok: true });
      }

    }
    if (resource === "comments" && id && method === "DELETE") {
      const result = await db().comment.deleteMany({
        where: { id, authorId: user.id, post: { adminDeleted: false } },
      });
      if (!result.count)
        throw new HttpError("본인의 댓글만 삭제할 수 있습니다.", 403);
      return json({ ok: true });
    }
    throw new HttpError("없는 경로입니다.", 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        { error: e.issues[0]?.message ?? "입력값을 확인해주세요." },
        400,
      );
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("API failure", e instanceof Error ? e.message : "unknown");
    return json(
      { error: "서버 연결을 확인해주세요. 잠시 후 다시 시도할 수 있습니다." },
      503,
    );
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
