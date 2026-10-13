"use client";
import { thumbnailUrl } from "@/lib/images";
import { useState } from "react";
import { ImageViewer } from "./image-viewer";
import type { Post } from "@/lib/types";
export function DetailPhotos({ post }: { post: Post }) {
  const photos = post.imageUrls?.length ? post.imageUrls : [post.imageUrl!];
  const [index, setIndex] = useState(0);
  return (
    <div className="detail-photos">
      <ImageViewer
        key={index}
        src={photos[index]}
        sources={photos}
        alt={post.title}
        initialIndex={index}
      />
      <span className="detail-photo-count">
        {index + 1} / {photos.length}
      </span>
      <div className="detail-photo-thumbnails">
        {photos.map((src, i) => (
          <button
            key={src}
            aria-label={`사진 ${i + 1} 선택`}
            aria-pressed={index === i}
            onClick={() => setIndex(i)}
          >
            <img src={thumbnailUrl(src)!} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
