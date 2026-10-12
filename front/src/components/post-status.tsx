"use client";
import { postStatus } from "@/lib/freshness";
import type { Post } from "@/lib/types";
import { useVillage } from "./store";

export function PostStatus({ post }: { post: Post }) {
  const { now } = useVillage();
  const status = postStatus(post, new Date(now));
  return <div className="my-3 text-xs text-muted" aria-label="일정과 현장 확인">
    {post.category === "NOTICE" ? <p>{status.schedule}</p> :
      <span className={`visit-status-tag ${status.schedule === "오늘와요" ? "visit-today" : "visit-not-today"}`}>{status.schedule}</span>}
    {status.observation && <p className="mt-2">{status.observation}</p>}
  </div>;
}
