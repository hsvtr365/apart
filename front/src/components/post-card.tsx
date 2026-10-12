"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";
import { Presence } from "./presence";
import { PostActions } from "./post-actions";
import { PostImages } from "./post-images";
import { categories, clock, type Post } from "@/lib/types";
export function PostCard({ post }: { post: Post }) {
  const [expanded, setExpanded] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const content = (
    <>
      <h3 className="mb-1">{post.title}</h3>
      <p
        className={
          "whitespace-pre-line break-words " +
          (!expanded ? "line-clamp-2" : "")
        }
      >
        {post.body}
      </p>
    </>
  );
  return (
    <article className="post">
      <div className="flex items-center justify-between gap-2 py-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <b className="post-author-name">{post.author}</b>
          {post.authorBuilding && <small className="author-building-tag">{post.authorBuilding}</small>}
          <small
            title="등록 시각"
          >
            {clock(post.createdAt)}
          </small>
        </div>
        <span className={`category-tag category-${post.category.toLowerCase()}`}>
          {categories[post.category]}
        </span>
      </div>
              <Link
          href={"/post/" + post.id}
          className="block"
          aria-label={post.title + " 상세 보기"}
        >
          {content}
        </Link>
      {post.body.length > 70 && (
        <button
          className="icon-btn text-brand"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}
      {post.imageUrl ? (
        <div className="post-media">
          <PostImages urls={post.imageUrls?.length ? post.imageUrls : [post.imageUrl]} alt={post.title} href={"/post/" + post.id} onIndexChange={setPhotoIndex} />
          {post.category !== "NOTICE" && (
            <Link
              className="icon-btn absolute left-2 top-2 bg-white text-brand"
              href={"/map/" + post.id}
              aria-label="지도에서 위치 보기"
            >
              <Icon name="pin" />
            </Link>
          )}
          {post.category === "FOOD" && (
            <div className="absolute right-2 top-2 flex">
              <Presence post={post} />
            </div>
          )}
          <PostActions post={post} expandPhotoIndex={photoIndex} />
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            {post.category !== "NOTICE" && (
              <Link
                className="icon-btn bg-soft text-brand"
                href={"/map/" + post.id}
                aria-label="지도에서 위치 보기"
              >
                <Icon name="pin" />
              </Link>
            )}
            {post.category === "FOOD" && <Presence post={post} />}
          </div>
          <PostActions post={post} />
        </>
      )}
    </article>
  );
}
