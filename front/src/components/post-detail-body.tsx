"use client";
import Link from "next/link";
import { Icon } from "./icons";
import { Presence } from "./presence";
import { PostActions } from "./post-actions";
import { categories, clock, weekdayLabels, seasonLabels, type Post } from "@/lib/types";
export function PostDetailBody({ post }: { post: Post }) {
  return <article className="post-detail-content">
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <b className="post-author-name">{post.author}</b>
          {post.authorBuilding && <small>{post.authorBuilding}</small>}
          <small
            title={post.observedAt ? "마지막 현장 관찰 시각" : "등록 시각"}
          >
            {clock(post.observedAt || post.createdAt)}
          </small>
        </div>
        <span className={`category-tag category-${post.category.toLowerCase()}`}>
          {categories[post.category]}
        </span>
      </div>
            <p className="whitespace-pre-line break-words">{post.body}</p>
      <div className="mt-2 flex items-center gap-2">
        {post.category !== "NOTICE" && <Link className="icon-btn bg-soft text-brand" href={"/map/" + post.id} aria-label="지도에서 위치 보기"><Icon name="pin" /></Link>}
        {post.category === "FOOD" && <Presence post={post} />}
      </div>
      <PostActions post={post} />
      {post.category === "NOTICE" && post.noticeStartDate && post.noticeEndDate && (
        <p className="text-xs text-muted mt-2">공고 기간 · {post.noticeStartDate} ~ {post.noticeEndDate}</p>
      )}
      {post.category !== "NOTICE" && (post.startDate || post.weekdays?.length > 0 || post.seasons?.length > 0 || post.arrivalTime || post.departureTime) && (
        <p className="text-xs text-muted mt-2">
          {[post.scheduleType === "ONCE" ? `1회 · ${post.startDate ?? "날짜 미정"}${post.finishDate ? ` ~ ${post.finishDate}` : ""}` : `매주 ${post.weekdays?.map(day => weekdayLabels[day]).join("·") || "요일 미정"}`,
            post.arrivalTime ? `${post.arrivalTime} 도착 예정` : "",
            post.departureTime ? `${post.departureTime} 출발 예정` : "",
            post.seasons?.map(season => seasonLabels[season]).join("·")].filter(Boolean).join(" / ")}
        </p>
      )}
    </article>;
}
