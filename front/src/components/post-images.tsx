"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
export function PostImages({ urls, alt, href, onIndexChange }: { urls: string[]; alt: string; href?: string; onIndexChange?: (index: number) => void }) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, urls.length - 1);
  function change(next: number) { setIndex(next); onIndexChange?.(next); }
  const source = urls[current].startsWith("/api/uploads/") ? urls[current] + "?size=feed" : urls[current];
  return (
    <div className="post-image-gallery">
      {href ? <Link href={href} scroll={false} aria-label={alt + " 사진으로 상세 보기"}><img src={source} alt={alt} loading="lazy" decoding="async" /></Link> : <img src={source} alt={alt} loading="lazy" decoding="async" />}
      {urls.length > 1 && (
        <>
          <span className="photo-counter">
            {current + 1}/{urls.length}
          </span>
          <button
            type="button"
            className="photo-prev"
            aria-label="이전 사진"
            onClick={() => change((current + urls.length - 1) % urls.length)}
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="photo-next"
            aria-label="다음 사진"
            onClick={() => change((current + 1) % urls.length)}
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
