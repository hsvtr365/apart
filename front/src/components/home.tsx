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
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  LayoutGrid,
  MapPin,
  Megaphone,
  Pause,
  Play,
  ShoppingBasket,
  Store,
  TrendingUp,
} from "lucide-react";
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
  const interacting = useRef(false);
  useEffect(() => {
    const el = roller.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanScroll(max > 1);
      setScrollEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 });
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
        <h2><SectionIcon size={23} strokeWidth={2.5} aria-hidden="true" />{title}</h2>
        {canScroll && <div className="flex">
          <button
            className="icon-btn"
            aria-label={`${title} 이전 소식`}
            disabled={scrollEdges.start}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            className="icon-btn"
            aria-label={paused ? "자동 넘김 재생" : "자동 넘김 일시정지"}
            onClick={() => setPaused(!paused)}
          >
            {paused ? (
              <Play size={18} aria-hidden="true" />
            ) : (
              <Pause size={18} aria-hidden="true" />
            )}
          </button>
          <button
            className="icon-btn"
            aria-label={`${title} 다음 소식`}
            disabled={scrollEdges.end}
            onClick={() => move(1)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>}
      </div>
      <div
        className="news-roller"
        ref={roller}
        onScroll={() => {
          const el = roller.current;
          if (!el) return;
          const max = el.scrollWidth - el.clientWidth;
          setScrollEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 });
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
            href={"/feed/" + p.category.toLowerCase()}
            className="news-card"
            key={p.id}
          >
            <span className={`news-card-category news-${p.category.toLowerCase()}`}>
              {p.category === "NOTICE" ? <CalendarDays size={15} aria-hidden="true" /> : p.category === "FOOD" ? <ShoppingBasket size={15} aria-hidden="true" /> : <Store size={15} aria-hidden="true" />}
              {p.category === "NOTICE" && p.noticeEndDate
                ? `~ ${Number(p.noticeEndDate.slice(5, 7))}월 ${Number(p.noticeEndDate.slice(8, 10))}일`
                : categories[p.category]}
            </span>
            <b className="news-card-title">{p.title}</b>
            <p className="news-card-body">{p.body}</p>
            {p.imageUrl && <img className="news-card-image" src={p.imageUrl} alt="" loading="lazy" />}
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
        <h2><TrendingUp size={23} strokeWidth={2.5} aria-hidden="true" />생활 피드</h2>
      </div>
      <div className="home-feed-filters">
        {[["all", "전체"], ...Object.entries(categories)].map(
          ([key, label]) => (
            <Link
              key={key}
              href={key === "all" ? "/feed" : "/feed/" + key.toLowerCase()}
              className={"home-feed-filter" + (key === "all" ? " active" : "")}
            >
              {key === "all" ? <LayoutGrid size={19} aria-hidden="true" /> : key === "FOOD" ? <ShoppingBasket size={19} aria-hidden="true" /> : key === "NOTICE" ? <Building2 size={19} aria-hidden="true" /> : <Store size={19} aria-hidden="true" />}
              {label}
            </Link>
          ),
        )}
      </div>
      <div className="home-section-heading">
        <h2><MapPin size={23} strokeWidth={2.5} aria-hidden="true" />우리 동네 기관</h2>
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
