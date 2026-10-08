"use client";
import Link from "next/link";
import type { Post } from "@/lib/types";
import { Presence } from "./post-card";
import { Icon } from "./icons";
import { KakaoMap } from "./kakao-map";
import { useVillage } from "./store";
export function VillageMap({
  posts,
  full = false,
  selected,
}: {
  posts: Post[];
  full?: boolean;
  selected?: string;
}) {
  const { data } = useVillage();
  const demo = data?.mode === "demo";
  const points = posts.filter((p) => p.mapX !== null && p.mapY !== null);
  const shown = selected
    ? [
        ...points.filter((p) => p.id === selected),
        ...points.filter((p) => p.id !== selected),
      ].slice(0, 4)
    : points.slice(0, 4);
  return (
    <div className={"map-view " + (full ? "full" : "")}>
      {!demo && <KakaoMap posts={posts} selected={selected} />}
      {demo && (
        <img className="map-art" src="/map.svg" alt="단지 배치 예시 지도" />
      )}
      {demo &&
        shown.map((p) => (
          <div
            key={p.id}
            className={"map-pin " + (selected === p.id ? "selected" : "")}
            style={{
              left: `clamp(72px, ${p.mapX}%, calc(100% - 72px))`,
              top: `clamp(130px, ${p.mapY}%, calc(100% - 90px))`,
              zIndex: selected === p.id ? 2 : 1,
            }}
          >
            <small>
              {p.place}
              {p.observedAt ? " · 방금 확인" : ""}
            </small>
            <Link
              href={"/post/" + p.id}
              className="flex min-h-11 items-center font-semibold"
            >
              {p.title}
            </Link>
            {p.category === "FOOD" && <Presence post={p} />}
          </div>
        ))}
      {demo && !shown.length && (
        <p className="absolute left-4 top-24 rounded-sm bg-white p-3">
          지도에 표시할 소식이 아직 없어요.
        </p>
      )}
      {full ? (
        <div className="absolute left-3 right-3 top-3 z-10 flex items-center gap-2 rounded-sm border border-line bg-white px-2">
          <Link className="icon-btn" href="/" aria-label="홈으로">
            <Icon name="back" />
          </Link>
          <b>햇빛마을20단지</b>
          <Link className="icon-btn ml-auto" href="/feed">
            피드 보기
          </Link>
        </div>
      ) : (
        <Link
          href="/map"
          className="btn btn-secondary absolute right-2 top-2 z-10"
        >
          지도 크게 보기
        </Link>
      )}
      {demo && (
        <small className="absolute bottom-2 left-2">
          단지 배치 예시 · 데모
        </small>
      )}
    </div>
  );
}
