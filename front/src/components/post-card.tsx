"use client";
import Link from "next/link";
import { useState } from "react";
import { useVillage } from "./store";
import { Icon } from "./icons";
import { categories, clock, type Post } from "@/lib/types";
export function Presence({ post, map = false, onConfirmed }: { post: Post; map?: boolean; onConfirmed?: () => void }) {
  const { act, notify, busy } = useVillage();
  return (
    <div className="presence">
      {(["ARRIVED", "GONE"] as const).map((state) => (
        <button
          key={state}
          aria-pressed={post.presence === state}
          disabled={busy}
          onClick={() =>
            void act("presence", post.id, { state })
              .then(() => {
                onConfirmed?.();
                notify("현장 상태를 반영했어요.");
              })
              .catch((e) => notify(e.message))
          }
        >
          {map && (
            <Icon
              name={state === "ARRIVED" ? "check" : "close"}
              strokeWidth="2.5"
            />
          )}
          {state === "ARRIVED" ? (map ? "있어요" : "왔어요") : "갔어요"}
        </button>
      ))}
    </div>
  );
}
export function PostCard({
  post,
  full = false,
  hideImage = false,
}: {
  post: Post;
  full?: boolean;
  hideImage?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
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
  const actions = (
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
      <button className="icon-btn ml-auto" onClick={share}>
        공유
      </button>
    </div>
  );
  const content = (
    <>
      <h3 className="mb-1">{post.title}</h3>
      <p
        className={
          "whitespace-pre-line break-words " +
          (!full && !expanded ? "line-clamp-2" : "")
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
          <b>{post.author}</b>
          {post.authorBuilding && <small>{post.authorBuilding}</small>}
          <small
            title={post.observedAt ? "마지막 현장 관찰 시각" : "등록 시각"}
          >
            {post.place} · {clock(post.observedAt || post.createdAt)}
          </small>
        </div>
        <small className="shrink-0">{categories[post.category]}</small>
      </div>
      {full ? (
        content
      ) : (
        <Link
          href={"/post/" + post.id}
          className="block"
          aria-label={post.title + " 상세 보기"}
        >
          {content}
        </Link>
      )}
      {!full && post.body.length > 70 && (
        <button
          className="icon-btn text-brand"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}
      {post.imageUrl && !hideImage ? (
        <div className="post-media">
          <img src={post.imageUrl} alt={post.title} />
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
            <div className="absolute right-2 top-2 flex bg-white">
              <Presence post={post} />
            </div>
          )}
          {actions}
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
          {actions}
        </>
      )}
      {full && post.endDate && (
        <small>
          종료 예정 · {post.endDate} {post.endTime || "시간 미정"}
        </small>
      )}
    </article>
  );
}
