"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { occursToday } from "@/lib/map-filter";
import type { Post } from "@/lib/types";
import { Presence } from "./presence";
import { KakaoMap } from "./kakao-map";
import { request, useVillage } from "./store";
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
  const { data, revision, updatedPost } = useVillage();
  const demo = data?.mode === "demo";
  const [todayOnly, setTodayOnly] = useState(!selected);
  const [food, setFood] = useState(true);
  const [market, setMarket] = useState(true);
  const [remotePosts, setRemotePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const options = { signal: controller.signal };
    async function load() {
      const params = new URLSearchParams({ today: String(!full || todayOnly) });
      if (full && food !== market)
        params.set("category", food ? "FOOD" : "MARKET");
      const result: Post[] = [];
      if (!full || food || market) {
        let cursor: string | null = null;
        do {
          if (cursor) params.set("cursor", cursor);
          const page: { posts: Post[]; nextCursor: string | null } =
            await request("/api/map-posts?" + params, options);
          result.push(
            ...page.posts.filter(
              (p) => !result.some((existing) => existing.id === p.id),
            ),
          );
          cursor = page.nextCursor;
        } while (cursor);
      }
      if (selected) {
        const post = await request<Post>(
          "/api/posts/" + encodeURIComponent(selected),
          options,
        );
        if (
          post.hidden ||
          post.adminDeleted ||
          post.userDeleted ||
          post.category === "NOTICE" ||
          post.latitude == null ||
          post.longitude == null
        )
          throw new Error("선택한 소식은 지도에 표시할 수 없어요.");
        if (!result.some((p) => p.id === post.id)) result.push(post);
      }
      if (!controller.signal.aborted) setRemotePosts(result);
    }
    void load()
      .catch((e) => {
        if (!controller.signal.aborted) {
          setRemotePosts([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [demo, full, todayOnly, food, market, selected, revision, retry]);
  useEffect(() => {
    if (updatedPost)
      setRemotePosts((posts) =>
        posts.map((post) => (post.id === updatedPost.id ? updatedPost : post)),
      );
  }, [updatedPost]);
  const visible = (demo ? posts : remotePosts).filter((p) => {
    if (p.hidden || p.adminDeleted || p.userDeleted) return false;
    if (p.id === selected) return true;
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
      {!demo && (loading || error) && (
        <div className="map-load-status" role={error ? "alert" : "status"}>
          {error || "지도 소식을 불러오는 중이에요."}
          {error && (
            <button className="btn" onClick={() => setRetry((v) => v + 1)}>
              다시 시도
            </button>
          )}
        </div>
      )}
      {!demo && !loading && !error && !visible.length && (
        <p className="map-load-status">조건에 맞는 지도 소식이 없어요.</p>
      )}
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
