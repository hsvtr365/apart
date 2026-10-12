"use client";
import { postStatus } from "@/lib/freshness";
import { clock, type Post } from "@/lib/types";
import { useVillage } from "./store";

export function PostStatus({
  post,
  compact = false,
}: {
  post: Post;
  compact?: boolean;
}) {
  const { data, now } = useVillage();
  const status = postStatus(post, new Date(now), data?.freshnessMinutes);
  return (
    <div className="my-2 text-xs text-muted" aria-label="일정과 현장 확인">
      <p>{status.schedule}</p>
      {status.observation && <p>{status.observation}</p>}
      {!compact && post.observedAt && (
        <p>현장 확인 · {clock(post.observedAt)} (사용자 제보)</p>
      )}
      {!compact && post.category === "FOOD" && (
        <p>
          최근 기준 {data?.freshnessMinutes ?? 120}분(시범) · 사용자 제보 기준
        </p>
      )}
    </div>
  );
}
