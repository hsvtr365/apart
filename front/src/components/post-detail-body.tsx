"use client";
import { UserRound } from "lucide-react";
import { PostActions } from "./post-actions";
import { type Post } from "@/lib/types";
import { Breadcrumbs } from "./breadcrumbs";
import { useVillage } from "./store";
export function PostDetailBody({ post }: { post: Post }) {
  const { notify } = useVillage();
  const date = (iso: string) =>
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  return (
    <article className="post-detail-content">
      <Breadcrumbs path={"/post/" + post.id} post={post} />
      <p className="detail-post-text">{post.body}</p>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${post.title}\n\n${post.body}`);
            notify("게시글 텍스트를 복사했어요.");
          } catch {
            notify("텍스트를 복사하지 못했어요. 본문을 선택해 복사해주세요.");
          }
        }}
      >
        글 복사
      </button>
      <div className="detail-author">
        <UserRound size={22} aria-hidden="true" />
        <b>{post.author}</b>
        {post.authorBuilding && (
          <span className="author-building-tag">{post.authorBuilding}</span>
        )}
        <time dateTime={post.createdAt}>작성 {date(post.createdAt)}</time>
        {post.updatedAt && post.updatedAt !== post.createdAt && (
          <time dateTime={post.updatedAt}>수정 {date(post.updatedAt)}</time>
        )}
      </div>
      <PostActions post={post} />
    </article>
  );
}
