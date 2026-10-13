"use client";
import { UserRound } from "lucide-react";
import { PostActions } from "./post-actions";
import { clock, type Post } from "@/lib/types";
export function PostDetailBody({ post }: { post: Post }) {
  return <article className="post-detail-content">
    <p className="detail-post-text">{post.body}</p>
    <div className="detail-author">
      <UserRound size={22} aria-hidden="true" /><b>{post.author}</b>
      {post.authorBuilding && <span className="author-building-tag">{post.authorBuilding}</span>}
      <time dateTime={post.createdAt}>· {clock(post.createdAt)}</time>
    </div>
    <PostActions post={post} />
  </article>;
}
