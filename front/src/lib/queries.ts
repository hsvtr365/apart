import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import type { Post, Notice } from "./types";
const include = {
  author: { select: { id: true, nickname: true } },
  _count: { select: { likes: true, comments: true } },
  presences: { orderBy: { observedAt: "desc" as const }, take: 1 },
};
export async function getPosts(
  userId?: string,
  cursor?: string,
  where: Prisma.PostWhereInput = {},
  limit = 30,
): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const rows = await db().post.findMany({
    where,
    include,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const likes = userId
    ? await db().like.findMany({
        where: { userId, postId: { in: page.map((p) => p.id) } },
      })
    : [];
  return {
    nextCursor: more ? page.at(-1)!.id : null,
    posts: page.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      category: p.category,
      place: p.place,
      mapX: p.mapX,
      mapY: p.mapY,
      latitude: p.latitude,
      longitude: p.longitude,
      imageUrl: p.imageUrl,
      createdAt: p.createdAt.toISOString(),
      endDate: p.endDate,
      endTime: p.endTime,
      authorId: p.authorId,
      author: p.author.nickname,
      likes: p._count.likes,
      liked: likes.some((l) => l.postId === p.id),
      commentCount: p._count.comments,
      comments: [],
      presence: p.presences[0]?.state ?? null,
      observedAt: p.presences[0]?.observedAt.toISOString() ?? null,
    })),
  };
}
export async function notifications(userId: string): Promise<Notice[]> {
  const items = await db().notification.findMany({
    where: { userId },
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
