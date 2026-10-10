"use client";
import { useState } from "react";
export function PostImages({ urls, alt }: { urls: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, urls.length - 1);
  return (
    <div className="post-image-gallery">
      <img src={urls[current]} alt={alt} />
      {urls.length > 1 && (
        <>
          <span className="photo-counter">
            {current + 1}/{urls.length}
          </span>
          <button
            type="button"
            className="photo-prev"
            aria-label="이전 사진"
            onClick={() => setIndex((current + urls.length - 1) % urls.length)}
          >
            ‹
          </button>
          <button
            type="button"
            className="photo-next"
            aria-label="다음 사진"
            onClick={() => setIndex((current + 1) % urls.length)}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
