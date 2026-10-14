"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useVillage } from "./store";
import { Home, FeedTabs } from "./home";
import { PostCard } from "./post-card";
import { VillageMap } from "./village-map";
import { Report } from "./report";
import { Account } from "./account";
import { PostDetail } from "./post-detail";
import { LoadingMask } from "./loading-mask";
import type { Post } from "@/lib/types";
import {
  Home as HomeIcon,
  Map,
  Newspaper,
  Plus,
  UserRound,
} from "lucide-react";
export function VillageApp({
  initialPost,
  initialFeed,
  initialCategory,
}: {
  initialPost?: Post | null;
  initialFeed?: { posts: Post[]; nextCursor: string | null };
  initialCategory?: string;
}) {
  const { data, error, message, reload, more, notify, feeds, loadFeed } =
    useVillage();
  const router = useRouter();
  const path = usePathname();
  const postId = path.startsWith("/post/") ? path.split("/")[2] : undefined;
  const background = useRef(postId ? "/feed" : path);
  const hasBackground = useRef(!postId);
  if (!postId) {
    background.current = path;
    hasBackground.current = true;
  }
  const [section = "home", id] = background.current.split("/").filter(Boolean);
  const scroll = useRef<HTMLDivElement>(null);
  const previousBackground = useRef(background.current);
  const positions = useRef<Record<string, number>>({});
  const category = ["food", "notice", "market"].includes(id) ? id : "all";
  const [feedError, setFeedError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    setFeedError("");
    if (section === "feed")
      void loadFeed(category).catch((e) => setFeedError(e.message));
  }, [section, category, loadFeed, data?.mode]);
  useLayoutEffect(() => {
    if (previousBackground.current !== background.current) {
      scroll.current?.scrollTo(0, positions.current[background.current] ?? 0);
      previousBackground.current = background.current;
    }
  }, [path]);
  const links = [
    ["/", HomeIcon, "홈"],
    ["/map", Map, "지도"],
    ["/report", Plus, "제보"],
    ["/feed", Newspaper, "피드"],
    ["/my", UserRound, "내 정보"],
  ] as const;
  const currentFeed =
    data?.mode === "demo"
      ? {
          posts: data.posts.filter(
            (p) =>
              !p.hidden &&
              !p.adminDeleted &&
              !p.userDeleted &&
              (category === "all" || p.category === category.toUpperCase()),
          ),
          nextCursor: null,
        }
      : (feeds[category] ??
        (initialCategory === category ? initialFeed : undefined));
  const feed = (
    <>
      <h1 className="page-title">생활 피드</h1>
      <FeedTabs selected={category} />
      {feedError && (
        <div role="alert">
          {feedError}
          <button
            className="btn"
            onClick={() => {
              setFeedError("");
              void loadFeed(category).catch((e) => setFeedError(e.message));
            }}
          >
            다시 시도
          </button>
        </div>
      )}
      {!currentFeed && !feedError && (
        <p role="status">소식을 불러오는 중이에요.</p>
      )}
      {currentFeed?.posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {currentFeed && !currentFeed.posts.length && (
        <div className="empty mt-3">
          등록된 소식이 없어요.{" "}
          <Link className="icon-btn text-brand" href="/report">
            첫 소식 올리기
          </Link>
        </div>
      )}
      {currentFeed?.nextCursor && (
        <button
          className="btn btn-secondary w-full"
          disabled={loadingMore}
          onClick={() => {
            setLoadingMore(true);
            void more(category)
              .catch((e) => notify(e.message))
              .finally(() => setLoadingMore(false));
          }}
        >
          {loadingMore ? "불러오는 중…" : "이전 소식 더 보기"}
        </button>
      )}
    </>
  );
  return (
    <div className="app">
      {section === "home" && (
        <header className="shrink-0 border-b border-line">
          <div className="mx-auto flex h-13 max-w-295 items-center justify-between px-4 md:px-8">
            <h1 className="font-bold text-lg">
              <Link href="/">햇빛마을20단지</Link>
            </h1>
            <a
              href="https://open.kakao.com/o/gG05eXOi"
              className="open-chat-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/kakaotalk.png" width={24} height={24} alt="" />
              단톡방
            </a>
          </div>
        </header>
      )}
      {data?.mode === "demo" && (
        <div className="shrink-0 bg-soft px-4 py-1 text-center text-xs text-muted">
          데모 · 변경 내용은 새로고침하면 초기화됩니다.
        </div>
      )}
      <div
        ref={scroll}
        onScroll={(event) => {
          positions.current[previousBackground.current] =
            event.currentTarget.scrollTop;
        }}
        className={"content-scroll " + (section === "map" ? "map-scroll" : "")}
      >
        {error ? (
          <div className="empty m-4" role="alert">
            <p>{error}</p>
            <button className="btn mt-3" onClick={() => void reload()}>
              다시 시도
            </button>
          </div>
        ) : !data ? (
          <LoadingMask overlay />
        ) : section === "map" ? (
          <VillageMap posts={data.posts} full selected={id} />
        ) : (
          <main
            className={"page-wrap " + (section === "home" ? "home-wrap" : "")}
          >
            {section === "home" ? (
              <Home />
            ) : section === "report" ? (
              <Report />
            ) : section === "my" ? (
              <Account />
            ) : (
              feed
            )}
          </main>
        )}
      </div>
      {data && section !== "report" && section !== "my" && (
        <button
          className="refresh-news"
          onClick={() => void reload()}
          aria-label="소식 새로고침"
        >
          ↻ 새로고침
        </button>
      )}
      <nav className="bottom-nav" aria-label="하단 주요 메뉴">
        {links.map(([href, NavIcon, label]) => {
          const active =
            href === "/" ? section === "home" : section === href.slice(1);
          return (
            <Link
              key={href}
              scroll={false}
              href={href}
              aria-current={active ? "page" : undefined}
            >
              <NavIcon size={22} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      {postId && data && (
        <PostDetail
          key={postId}
          id={postId}
          initialPost={initialPost?.id === postId ? initialPost : undefined}
          onClose={() =>
            hasBackground.current ? router.back() : router.replace("/feed")
          }
        />
      )}
      <div role="status" aria-live="polite" className={message ? "toast" : ""}>
        {message}
      </div>
    </div>
  );
}
