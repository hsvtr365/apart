import { db } from "./db";
import { visitorHash } from "./visitor";
import type { Prisma } from "@/generated/prisma/client";
import type { Post, Notice } from "./types";
import { todayContext } from "./map-filter";
import { presenceOccurrence } from "./presence";
const include = {
  images: { orderBy: { position: "asc" as const } },
  author: { select: { id: true, nickname: true, building: true } },
  _count: { select: { likes: true, comments: true } },
  presences: { orderBy: { observedAt: "desc" as const }, take: 1 },
  visitorPresences: { orderBy: { observedAt: "desc" as const }, take: 1 },
  presenceEvents: {
    orderBy: [{ observedAt: "desc" as const }, { id: "desc" as const }],
    take: 1,
  },
};
export async function getPosts(
  userId?: string,
  cursor?: string,
  where: Prisma.PostWhereInput = {},
  limit = 30,
  includeHidden = false,
): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const rows = await db().post.findMany({
    where: {
      AND: [
        where,
        { userDeleted: false },
        ...(includeHidden ? [] : [{ hidden: false, adminDeleted: false }]),
      ],
    },
    include,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const now = new Date();
  const occurrences = new Map(
    page.map((p) => [p.id, presenceOccurrence(p, now)]),
  );
  const visitor = await visitorHash();
  const [confirmations, memberConfirmations, likes] = await Promise.all([
    visitor
      ? db().visitorPresence.findMany({
          where: {
            visitorHash: visitor,
            postId: { in: page.map((p) => p.id) },
          },
          select: { postId: true, observedAt: true, occurrence: true },
        })
      : Promise.resolve([]),
    userId
      ? db().presence.findMany({
          where: { userId, postId: { in: page.map((p) => p.id) } },
          select: { postId: true, observedAt: true, occurrence: true },
        })
      : Promise.resolve([]),
    userId
      ? db().like.findMany({
          where: { userId, postId: { in: page.map((p) => p.id) } },
        })
      : Promise.resolve([]),
  ]);
  const confirmed = new Set(
    [...confirmations, ...memberConfirmations]
      .filter((c) => {
        const post = page.find((p) => p.id === c.postId)!;
        return (
          (c.occurrence ?? presenceOccurrence(post, c.observedAt)) ===
          occurrences.get(c.postId)
        );
      })
      .map((p) => p.postId),
  );
  const reports = (p: (typeof page)[number]) =>
    [...p.presences, ...p.visitorPresences, ...p.presenceEvents]
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
  const latest = (p: (typeof page)[number]) =>
    reports(p)
      .filter(
        (event) =>
          (event.occurrence ?? presenceOccurrence(p, event.observedAt)) ===
          occurrences.get(p.id),
      )
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())[0];
  return {
    nextCursor: more ? page.at(-1)!.id : null,
    posts: page.map((p) => ({
      id: p.id,
      hidden: p.hidden,
      adminDeleted: p.adminDeleted,
      userDeleted: p.userDeleted,
      title: p.title,
      body: p.body,
      category: p.category,
      mapX: p.mapX,
      mapY: p.mapY,
      latitude: p.latitude,
      longitude: p.longitude,
      imageUrl: p.images[0]?.url ?? null,
      imageUrls: p.images.map((image) => image.url),
      scheduleType: p.scheduleType as "WEEKLY" | "ONCE",
      startDate: p.startDate,
      finishDate: p.finishDate,
      noticeStartDate: p.noticeStartDate,
      noticeEndDate: p.noticeEndDate,
      weekdays: p.weekdays,
      seasons: p.seasons,
      arrivalTime: p.arrivalTime,
      departureTime: p.departureTime,
      createdAt: p.createdAt.toISOString(),
      authorId: p.authorId,
      author: p.author.nickname,
      authorBuilding: p.author.building,
      likes: p._count.likes,
      liked: likes.some((l) => l.postId === p.id),
      commentCount: p._count.comments,
      comments: [],
      presenceConfirmed: confirmed.has(p.id),
      presenceOccurrence: occurrences.get(p.id),
      lastPresenceReport: reports(p)[0] ? {
        state: reports(p)[0].state,
        observedAt: reports(p)[0].observedAt.toISOString(),
      } : null,
      presence: latest(p)?.state ?? null,
      observedAt: latest(p)?.observedAt.toISOString() ?? null,
    })),
  };
}
export function todayPostWhere(): Prisma.PostWhereInput {
  const { today, weekday, season } = todayContext();
  const foodOrMarket: Prisma.PostWhereInput[] = [
    {
      scheduleType: "WEEKLY",
      OR: [{ weekdays: { isEmpty: true } }, { weekdays: { has: weekday } }],
      AND: [
        { OR: [{ seasons: { isEmpty: true } }, { seasons: { has: season } }] },
      ],
    },
    {
      scheduleType: "ONCE",
      startDate: { lte: today },
      OR: [
        { finishDate: { gte: today } },
        { finishDate: null, startDate: today },
      ],
    },
  ];
  return {
    OR: [
      { category: "NOTICE", noticeStartDate: { lte: today }, noticeEndDate: { gte: today } },
      { category: { in: ["FOOD", "MARKET"] }, OR: foodOrMarket },
    ],
  };
}
export async function getTodayPosts(userId?: string) {
  const results = await Promise.all(
    (["NOTICE", "FOOD", "MARKET"] as const).map((category) =>
      getPosts(userId, undefined, { AND: [{ category }, todayPostWhere()] }, 8),
    ),
  );
  return results
    .flatMap((result) => result.posts)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function notifications(userId: string): Promise<Notice[]> {
  const items = await db().notification.findMany({
    where: {
      userId,
      post: {
        userDeleted: false,
        OR: [{ hidden: false, adminDeleted: false }, { authorId: userId }],
      },
    },
    include: {
      post: { select: { title: true } },
      comment: { include: { author: { select: { nickname: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return items.map((n) => ({
    id: n.id,
    postId: n.postId,
    commentId: n.commentId,
    title: n.post.title,
    body: n.comment.body,
    author: n.comment.author.nickname,
    readAt: n.readAt?.toISOString() ?? null,
  }));
}
export async function comments(postId: string, cursor?: string) {
  const rows = await db().comment.findMany({
    where: { postId },
    include: { author: { select: { nickname: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 31,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return {
    comments: rows.slice(0, 30).map((c) => ({
      id: c.id,
      body: c.body,
      authorId: c.authorId,
      author: c.author.nickname,
      createdAt: c.createdAt.toISOString(),
    })),
    nextCursor: rows.length > 30 ? rows[29].id : null,
  };
}
