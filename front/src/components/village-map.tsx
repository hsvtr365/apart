"use client";
import Link from "next/link";
import { useState } from "react";
import { occursToday } from "@/lib/map-filter";
import type { Post } from "@/lib/types";
import { Presence } from "./post-card";
import { KakaoMap } from "./kakao-map";
import { useVillage } from "./store";
import { Expand } from "lucide-react";
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
  const [todayOnly, setTodayOnly] = useState(!selected);
  const [food, setFood] = useState(true);
  const [market, setMarket] = useState(true);
  const visible = posts.filter((p) => {
    if (p.hidden || p.adminDeleted) return false;
    if (!full) return p.category !== "NOTICE" && occursToday(p);
    if (
      p.category === "NOTICE" ||
      (p.category === "FOOD" && !food) ||
      (p.category === "MARKET" && !market)
    )
      return false;
    return !todayOnly || occursToday(p);
  });
  const points = visible.filter((p) => p.mapX !== null && p.mapY !== null);
  const shown = selected
    ? [
        ...points.filter((p) => p.id === selected),
        ...points.filter((p) => p.id !== selected),
      ].slice(0, 4)
    : points.slice(0, 4);
  return (
    <div className={"map-view " + (full ? "full" : "")}>
      {!demo && <KakaoMap posts={visible} selected={selected} />}
      {full && (
        <div className="map-filters" role="group" aria-label="지도 표시 조건">
          <div className="map-filter-period">
            <button aria-pressed={todayOnly} onClick={() => setTodayOnly(true)}>
              오늘
            </button>
            <button
              aria-pressed={!todayOnly}
              onClick={() => setTodayOnly(false)}
            >
              모두
            </button>
          </div>
          <button aria-pressed={food} onClick={() => setFood(!food)}>
            먹거리
          </button>
          <button aria-pressed={market} onClick={() => setMarket(!market)}>
            요일장
          </button>
        </div>
      )}
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
            <small>{p.observedAt ? " · 방금 확인" : ""}</small>
            <Link
              href={"/post/" + p.id}
              className="flex min-h-11 items-center font-bold"
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
      {!full && (
        <Link
          href="/map"
          className="btn btn-secondary absolute right-2 top-2 z-10"
          aria-label="지도 크게 보기"
          title="지도 크게 보기"
        >
          <Expand size={20} aria-hidden="true" />
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
