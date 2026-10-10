"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useVillage } from "./store";
import { VillageMap } from "./village-map";
import { categories, type Post } from "@/lib/types";
import { sources } from "@/lib/sources";
import { isTodayNews } from "@/lib/map-filter";
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  LayoutGrid,
  MapPin,
  Megaphone,
  Pause,
  Play,
  Utensils,
  Store,
  TrendingUp,
} from "lucide-react";
export function FeedTabs({ selected = "all" }: { selected?: string }) {
  return (
    <nav className="tabs" aria-label="피드 분류">
      {[["all", "전체"], ...Object.entries(categories)].map(([key, label]) => (
        <Link
          key={key}
          className={`tab category-${key.toLowerCase()}`}
          href={key === "all" ? "/feed" : "/feed/" + key.toLowerCase()}
          aria-current={
            selected.toUpperCase() === key.toUpperCase() ? "page" : undefined
          }
        >
          {key === "all" ? <LayoutGrid size={18} aria-hidden="true" /> :
            key === "FOOD" ? <Utensils size={18} aria-hidden="true" /> :
            key === "NOTICE" ? <Building2 size={18} aria-hidden="true" /> :
            <Store size={18} aria-hidden="true" />}
          {label}
        </Link>
      ))}
    </nav>
  );
}
function HomeNewsSection({
  title,
  icon: SectionIcon,
  posts,
  emptyText,
}: {
  title: string;
  icon: typeof Megaphone;
  posts: Post[];
  emptyText: string;
}) {
  const roller = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [scrollEdges, setScrollEdges] = useState({ start: true, end: false });
  const [currentIndex, setCurrentIndex] = useState(0);
  const interacting = useRef(false);
  useEffect(() => {
    const el = roller.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanScroll(max > 1);
      setScrollEdges({
        start: el.scrollLeft <= 1,
        end: el.scrollLeft >= max - 1,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [posts.length]);
  function move(step: number, automatic = false) {
    const el = roller.current;
    if (!el) return;
    const width = (el.firstElementChild as HTMLElement)?.offsetWidth || 250;
    const max = el.scrollWidth - el.clientWidth;
    let next = Math.max(0, Math.min(max, el.scrollLeft + (width + 12) * step));
    if (automatic && step > 0 && el.scrollLeft >= max - 1) next = 0;
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
        canScroll &&
        !paused &&
        !interacting.current &&
        !document.hidden &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        move(1, true);
    }, 5500);
    return () => clearInterval(timer);
  }, [canScroll, paused]);
  return (
    <>
      <div className="home-section-heading">
        <h2>
          <SectionIcon size={23} strokeWidth={2.5} aria-hidden="true" />
          {title}
        </h2>
        {canScroll && (
          <div className="news-controls">
            <button
              className="carousel-arrow"
              aria-label={`${title} 이전 소식`}
              disabled={scrollEdges.start}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <span className="carousel-count" aria-live="polite">
              {currentIndex + 1} / {posts.length}
            </span>
            <button
              className="carousel-arrow"
              aria-label={`${title} 다음 소식`}
              disabled={scrollEdges.end}
              onClick={() => move(1)}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <button
              className="carousel-toggle"
              aria-label={paused ? "자동 넘김 재생" : "자동 넘김 멈춤"}
              onClick={() => setPaused(!paused)}
            >
              {paused ? (
                <Play size={17} aria-hidden="true" />
              ) : (
                <Pause size={17} aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>
      <div
        className="news-roller"
        ref={roller}
        onScroll={() => {
          const el = roller.current;
          if (!el) return;
          const max = el.scrollWidth - el.clientWidth;
          setScrollEdges({
            start: el.scrollLeft <= 1,
            end: el.scrollLeft >= max - 1,
          });
          const step =
            ((el.firstElementChild as HTMLElement)?.offsetWidth || 250) + 12;
          setCurrentIndex(
            Math.min(posts.length - 1, Math.round(el.scrollLeft / step)),
          );
        }}
        onPointerEnter={() => (interacting.current = true)}
        onPointerLeave={() => (interacting.current = false)}
        onFocus={() => (interacting.current = true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget))
            interacting.current = false;
        }}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {posts.map((p) => (
          <Link
            href={"/post/" + p.id}
            scroll={false}
            className={
              "news-card" + (p.category === "NOTICE" ? " news-card-notice" : "")
            }
            key={p.id}
          >
            {p.category === "NOTICE" ? (
              <>
                <div className="notice-card-date">
                  {p.noticeEndDate &&
                    (() => {
                      const date = new Date(`${p.noticeEndDate}T12:00:00`);
                      return (
                        <>
                          <small>{date.getMonth() + 1}월</small>
                          <b>{date.getDate()}</b>
                          <small>까지</small>
                        </>
                      );
                    })()}
                </div>
                <div className="notice-card-content">
                  <div className="notice-card-title-row">
                    <b className="news-card-title">{p.title}</b>
                    <ChevronRight className="notice-card-arrow" size={16} aria-hidden="true" />
                  </div>
                  <p className="news-card-body">{p.body}</p>
                </div>
              </>
            ) : (
              <>
                <span
                  className={`news-card-category news-${p.category.toLowerCase()}`}
                >
                  {p.category === "FOOD" ? (
                    <Utensils size={15} aria-hidden="true" />
                  ) : (
                    <Store size={15} aria-hidden="true" />
                  )}
                  {categories[p.category]}
                </span>
                <b className="news-card-title">{p.title}</b>
                <p className="news-card-body">{p.body}</p>
                <span
                  className="news-card-image"
                  aria-hidden="true"
                  style={{
                    backgroundImage: `linear-gradient(180deg, #fff 0%, rgba(255,255,255,.94) 30%, rgba(255,255,255,0) 65%), url("${p.imageUrl || (p.category === "MARKET" ? "/market.svg" : "/food.svg")}")`,
                  }}
                />
              </>
            )}
          </Link>
        ))}
      </div>
      {!posts.length && <div className="empty">{emptyText}</div>}
    </>
  );
}

export function Home() {
  const { data } = useVillage();
  if (!data) return null;
  const todayEligible =
    data.mode === "demo"
      ? data.posts.filter((p) => isTodayNews(p))
      : (data.todayPosts ?? []);
  const mapPosts =
    data.mode === "demo" ? todayEligible : (data.todayPosts ?? []);
  const todayPosts = todayEligible
    .filter((p) => p.category !== "NOTICE")
    .slice(0, 8);
  const notices = todayEligible
    .filter((p) => p.category === "NOTICE")
    .slice(0, 8);
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
        <VillageMap posts={mapPosts} />
      </div>
      <HomeNewsSection
        title="오늘의 소식"
        icon={Megaphone}
        posts={todayPosts}
        emptyText="오늘 예정된 소식이 없어요."
      />
      <HomeNewsSection
        title="관리사무소"
        icon={Bell}
        posts={notices}
        emptyText="진행 중인 공고가 없어요."
      />
      <div className="home-section-heading">
        <h2>
          <TrendingUp size={23} strokeWidth={2.5} aria-hidden="true" />
          생활 피드
        </h2>
      </div>
      <div className="home-feed-filters">
        {[["all", "전체"], ...Object.entries(categories)].map(
          ([key, label]) => (
            <Link
              key={key}
              href={key === "all" ? "/feed" : "/feed/" + key.toLowerCase()}
              className={`home-feed-filter category-${key.toLowerCase()}` + (key === "all" ? " active" : "")}
            >
              {key === "all" ? (
                <LayoutGrid size={19} aria-hidden="true" />
              ) : key === "FOOD" ? (
                <Utensils size={19} aria-hidden="true" />
              ) : key === "NOTICE" ? (
                <Building2 size={19} aria-hidden="true" />
              ) : (
                <Store size={19} aria-hidden="true" />
              )}
              {label}
            </Link>
          ),
        )}
      </div>
      <div className="home-section-heading">
        <h2>
          <MapPin size={23} strokeWidth={2.5} aria-hidden="true" />
          우리 동네 기관
        </h2>
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
