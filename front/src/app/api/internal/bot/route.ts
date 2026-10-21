import { z } from "zod";
import { createHash } from "node:crypto";
import { botAuthorized } from "@/lib/bot-auth";
import { db } from "@/lib/db";
import { createPost } from "@/lib/post-write";
import { prepareUpload } from "@/lib/upload-write";
import { HttpError, lockActiveAccount } from "@/lib/write-guards";
import { occursToday, todayContext } from "@/lib/map-filter";
import { presenceOccurrence } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + "T12:00:00+09:00");
  return !isNaN(+d) && todayContext(d).today === v;
});
const searchInput = z.object({ query: z.string().trim().max(100).default(""),
  category: z.enum(["FOOD", "NOTICE", "MARKET"]).nullable().default(null), date: date.nullable().default(null),
  noticeScope: z.enum(["SHORT", "ROUTINE", "ALL"]).default("SHORT") });

export async function POST(req: Request) {
  if (!botAuthorized(req.headers.get("authorization"))) return respond({ error: "Unauthorized" }, 401);
  const files: Awaited<ReturnType<typeof prepareUpload>>[] = [];
  try {
    if (Number(req.headers.get("content-length") || 0) > 50 * 1024 * 1024) throw new HttpError("요청이 너무 큽니다.", 413);
    if (req.headers.get("content-type")?.includes("application/json")) {
      const input = searchInput.parse(await req.json());
      const tokens = input.query.split(/\s+/).filter(Boolean).slice(0, 6);
      const rows = await db().post.findMany({ where: {
        hidden: false, adminDeleted: false, userDeleted: false,
        ...(input.noticeScope !== "ALL" ? { OR: [{ category: { not: "NOTICE" as const } }, { noticeKind: input.noticeScope }] } : {}),
        ...(input.category ? { category: input.category } : {}),
        AND: tokens.map(token => ({ OR: [{ title: { contains: token, mode: "insensitive" as const } }, { body: { contains: token, mode: "insensitive" as const } }] })),
      }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101,
        include: { presenceEvents: { orderBy: [{ observedAt: "desc" }, { id: "desc" }], take: 20 },
          presences: { orderBy: { observedAt: "desc" }, take: 20 }, visitorPresences: { orderBy: { observedAt: "desc" }, take: 20 } } });
      const now = new Date();
      const target = input.date ? new Date(input.date + "T12:00:00+09:00") : now;
      const posts = rows.slice(0, 100).map(p => ({ ...p,
        scheduleType: p.scheduleType === "ONCE" ? "ONCE" as const : "WEEKLY" as const,
        seasons: p.seasons.filter((s): s is "SPRING" | "SUMMER" | "AUTUMN" | "WINTER" => ["SPRING", "SUMMER", "AUTUMN", "WINTER"].includes(s)),
      })).filter(p => !input.date || (p.category === "NOTICE"
        ? !!p.noticeStartDate && !!p.noticeEndDate && p.noticeStartDate <= input.date && p.noticeEndDate >= input.date
        : occursToday(p, target))).slice(0, 15).map(p => {
        const occurrence = presenceOccurrence(p, target);
        const latest = [...p.presenceEvents, ...p.presences, ...p.visitorPresences]
          .filter(e => (e.occurrence ?? presenceOccurrence(p, e.observedAt)) === occurrence)
          .sort((a, b) => +b.observedAt - +a.observedAt)[0];
        return { id: p.id, title: p.title, body: p.body, category: p.category, noticeKind: p.noticeKind,
          scheduleType: p.scheduleType, weekdays: p.weekdays, seasons: p.seasons,
          startDate: p.startDate, finishDate: p.finishDate, noticeStartDate: p.noticeStartDate, noticeEndDate: p.noticeEndDate,
          arrivalTime: p.arrivalTime, departureTime: p.departureTime,
          scheduled: p.category === "NOTICE" ? null : occursToday(p, target),
          presence: latest?.state ?? null,
          observedAt: latest?.observedAt ?? null,
          lastPresenceReport: latest ? { state: latest.state, observedAt: latest.observedAt } : null };
      });
      return respond({ today: todayContext(now).today, posts, truncated: rows.length > 100 || posts.length === 15 });
    }
    const userId = process.env.BOT_AUTHOR_ID;
    if (!userId) throw new HttpError("봇 작성자 설정이 필요합니다.", 503);
    const form = await req.formData();
    const requestKey = z.string().regex(/^[a-f0-9]{64}$/).parse(form.get("requestKey"));
    const existing = await db().botPublication.findUnique({ where: { requestKey } });
    if (existing) return respond({ id: existing.postId, duplicate: true });
    const raw = JSON.parse(z.string().max(12000).parse(form.get("post")));
    const incoming = form.getAll("files");
    if (!incoming.length || incoming.length > 6 || incoming.some(f => !(f instanceof File))) throw new HttpError("사진 1~6장이 필요합니다.");
    if ((incoming as File[]).reduce((sum, file) => sum + file.size, 0) > 16 * 1024 * 1024)
      throw new HttpError("사진 합계는 16MB 이하여야 합니다.", 413);
    const hashes = [];
    for (const file of incoming as File[]) {
      if (file.size > 8 * 1024 * 1024) throw new HttpError("8MB 이하의 사진을 선택해주세요.", 413);
      hashes.push(createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex"));
    }
    const photoHash = createHash("sha256").update(hashes.sort().join(":" )).digest("hex");
    for (const file of incoming) files.push(await prepareUpload(file as File));
    const result = await db().$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"bot:" + requestKey}))`;
      const prior = await tx.botPublication.findUnique({ where: { requestKey } });
      if (prior) return { id: prior.postId, duplicate: true };
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"bot-photo:" + photoHash}))`;
      if (form.get("forceDuplicate") !== "true") {
        const candidates = await tx.botPublication.findMany({ where: { photoHash }, select: { postId: true }, take: 100 });
        const candidate = await tx.post.findFirst({ where: { id: { in: candidates.map(c => c.postId) }, hidden: false, userDeleted: false, adminDeleted: false }, select: { id: true } });
        if (candidate) return { id: candidate.id, duplicate: false, candidate: true };
      }
      await lockActiveAccount(tx, userId);
      for (const file of files) await tx.upload.create({ data: { id: file.name, userId } });
      const post = await createPost(tx, userId, { ...raw, hidden: false, mapX: null, mapY: null,
        latitude: null, longitude: null, imageUrl: null, imageUrls: files.map(f => f.url) });
      await tx.botPublication.create({ data: { requestKey, postId: post.id, photoHash } });
      return { id: post.id, duplicate: false };
    });
    if (result.duplicate || ("candidate" in result && result.candidate)) await Promise.all(files.map(f => f.remove()));
    return respond(result, result.duplicate ? 200 : 201);
  } catch (error) {
    await Promise.all(files.map(f => f.remove()));
    if (error instanceof z.ZodError) return respond({ error: error.issues.map(i => i.message).join(" ") }, 400);
    if (error instanceof HttpError) return respond({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return respond({ error: "잘못된 JSON입니다." }, 400);
    console.error("bot-api failed", { errorType: error instanceof Error ? error.name : "unknown" });
    return respond({ error: "봇 요청을 처리하지 못했습니다." }, 500);
  }
}
