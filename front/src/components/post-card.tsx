"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Presence } from "./presence";
import { PostActions } from "./post-actions";
import { PostImages } from "./post-images";
import { useVillage } from "./store";
import { occursToday } from "@/lib/map-filter";
import { categories, clock, weekdayLabels, seasonLabels, type Post } from "@/lib/types";

export function PostCard({ post }: { post: Post }) {
  const { now } = useVillage();
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = post.imageUrls?.length ? post.imageUrls : post.imageUrl ? [post.imageUrl] : [];
  const today = occursToday(post, new Date(now));
  const schedule = post.category === "NOTICE"
    ? [post.noticeStartDate, post.noticeEndDate].filter(Boolean).join(" ~ ")
    : [post.scheduleType === "ONCE" ? [post.startDate, post.finishDate].filter(Boolean).join(" ~ ") : post.weekdays.length ? `매주 ${post.weekdays.map(day => weekdayLabels[day]).join("·")}` : "",
      [post.arrivalTime, post.departureTime].filter(Boolean).join("~"),
      post.seasons.map(season => seasonLabels[season]).join("·")].filter(Boolean).join(" / ");
  return <article className="post feed-card">
    <div className={`feed-card-main ${photos.length ? "feed-card-with-photo" : ""}`}>
      {photos.length > 0 && <div className="feed-card-photo"><PostImages urls={photos} alt={post.title} href={"/post/" + post.id} onIndexChange={setPhotoIndex} /></div>}
      <div className="feed-card-info">
        <div className="feed-card-meta">
          {post.category !== "NOTICE" && <span className={`visit-status-tag ${today ? "visit-today" : "visit-not-today"}`}>{today ? "오늘 와요" : "오늘 안와요"}</span>}
          <time dateTime={post.createdAt}>{clock(post.createdAt)}</time>
          <span className={`category-tag category-${post.category.toLowerCase()}`}>{categories[post.category]}</span>
        </div>
        <Link href={"/post/" + post.id} scroll={false} className="feed-card-content" aria-label={post.title + " 상세 보기"}>
          <h3>{post.title}</h3>
          <p>{post.body}</p>
        </Link>
        {schedule && <p className="feed-card-schedule"><CalendarDays size={13} aria-hidden="true" /><span>{schedule}</span></p>}
        {post.category === "FOOD" && <Presence post={post} />}
      </div>
    </div>
    <PostActions post={post} expandPhotoIndex={photos.length ? photoIndex : undefined} />
  </article>;
}
