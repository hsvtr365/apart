"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useVillage } from "./store";
import { VillageMap } from "./village-map";
import { categories } from "@/lib/types";
import { sources } from "@/lib/sources";
import { isTodayNews } from "@/lib/map-filter";
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play } from "lucide-react";
export function FeedTabs({ selected = "all" }: { selected?: string }) {
  return (
    <nav className="tabs" aria-label="피드 분류">
      {[["all", "전체"], ...Object.entries(categories)].map(([key, label]) => (
        <Link
          key={key}
          className="tab"
          href={key === "all" ? "/feed" : "/feed/" + key.toLowerCase()}
          aria-current={
            selected.toUpperCase() === key.toUpperCase() ? "page" : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function Home() {
  const { data } = useVillage();
  const roller = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const interacting = useRef(false);
  function move(step: number) {
    const el = roller.current;
    if (!el) return;
    const width = (el.firstElementChild as HTMLElement)?.offsetWidth || 250;
    const max = el.scrollWidth - el.clientWidth;
    let next = el.scrollLeft + (width + 12) * step;
    if (next > max + 4) next = 0;
    if (next < 0) next = max;
    el.scrollTo({
      left: next,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        !paused &&
        !interacting.current &&
        !document.hidden &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        move(1);
    }, 5500);
    return () => clearInterval(timer);
  }, [paused]);
  if (!data) return null;
  const todayPosts = data.mode === "demo" ? data.posts.filter(p => isTodayNews(p)).slice(0, 8) : data.todayPosts ?? [];
  function group(start: number, end: number) {
    return (
      <div className="grid md:grid-cols-2 md:gap-x-6">
        {sources.slice(start, end).map((s) => (
          <a
            className="row flex items-center justify-between gap-3"
            href={s.url}
            key={s.name}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              <b className="block">{s.name}</b>
              <small className="mt-1 block">{s.description}</small>
            </span>
            <ExternalLink size={18} aria-hidden="true" />
          </a>
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="pt-3">
        <VillageMap posts={data.posts} />
      </div>
      <div className="mt-6 mb-2 flex items-center justify-between">
        <h2>오늘의 소식</h2>
        <div className="flex">
          <button
            className="icon-btn"
            aria-label="이전 소식"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            className="icon-btn"
            aria-label={paused ? "자동 넘김 재생" : "자동 넘김 일시정지"}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          </button>
          <button
            className="icon-btn"
            aria-label="다음 소식"
            onClick={() => move(1)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className="news-roller"
        ref={roller}
        onPointerEnter={() => (interacting.current = true)}
        onPointerLeave={() => (interacting.current = false)}
        onFocus={() => (interacting.current = true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget))
            interacting.current = false;
        }}
        onTouchStart={() => setPaused(true)}
      >
        {todayPosts.map((p) => (
          <Link
            href={"/feed/" + p.category.toLowerCase()}
            className="news-card"
            key={p.id}
          >
            <small>{categories[p.category]}</small>
            <b className="my-1 block">{p.title}</b>
          </Link>
        ))}
      </div>
      {!todayPosts.length && (
        <div className="empty">오늘 예정된 소식이 없어요.</div>
      )}
      <div className="mt-6 mb-2 flex items-center justify-between">
        <h2>생활 피드</h2>
        <Link href="/feed" className="icon-btn text-brand">
          전체 보기 <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="flex rounded-sm bg-soft">
        {[["all", "전체"], ...Object.entries(categories)].map(
          ([key, label]) => (
            <Link
              key={key}
              href={key === "all" ? "/feed" : "/feed/" + key.toLowerCase()}
              className="tab"
            >
              {label}
            </Link>
          ),
        )}
      </div>
      <div className="mt-6 mb-2 flex items-center justify-between">
        <h2>우리 동네 기관</h2>
        <small>외부 링크 · 새 탭</small>
      </div>
      {group(0, 4)}
      <details>
        <summary className="min-h-11 cursor-pointer py-3">
          고양시 기관·문화 채널 <small className="float-right">7곳</small>
        </summary>
        {group(4, sources.length)}
      </details>
    </>
  );
}
