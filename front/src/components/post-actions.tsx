"use client";
import Link from "next/link";
import { useVillage } from "./store";
import { Icon } from "./icons";
import type { Post } from "@/lib/types";
export function PostActions({ post }: { post: Post }) {
  const { act, notify, busy } = useVillage();
  async function share() {
    try {
      const url = location.origin + "/post/" + post.id;
      if (navigator.share) await navigator.share({ title: post.title, url });
      else {
        await navigator.clipboard.writeText(url);
        notify("소식 링크를 복사했어요.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        notify("링크를 복사하지 못했어요. 주소창의 링크를 사용해주세요.");
    }
  }
  return post.adminDeleted ? null : (
    <div className="post-actions">
      <button
        className="icon-btn"
        aria-label="좋아요"
        aria-pressed={post.liked}
        disabled={busy}
        onClick={() =>
          void act("like", post.id, { liked: !post.liked }).catch((e) =>
            notify(e.message),
          )
        }
      >
        <Icon name="heart" fill={post.liked ? "currentColor" : "none"} />
        <span>{post.likes}</span>
      </button>
      <Link
        href={"/post/" + post.id}
        className="icon-btn"
        aria-label="댓글 보기"
      >
        <Icon name="comment" />
        <span>{post.commentCount}</span>
      </Link>
      <button className="icon-btn ml-auto" onClick={share} aria-label="공유" title="공유">
        <Icon name="share" />
      </button>
    </div>
  );
}
