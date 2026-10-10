"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useVillage } from "./store";
import { Icon } from "./icons";
import { Home, FeedTabs } from "./home";
import { PostCard } from "./post-card";
import { VillageMap } from "./village-map";
import { Report } from "./report";
import { Account } from "./account";
import { PostDetail } from "./post-detail";
export function VillageApp() {
  const { data, error, message, reload, more, notify } = useVillage();
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
  useEffect(() => {
    if (previousBackground.current !== background.current) {
      scroll.current?.scrollTo(0, 0);
      previousBackground.current = background.current;
    }
  }, [path]);
  const links = [
    ["/", "home", "홈"],
    ["/map", "map", "지도"],
    ["/report", "plus", "제보"],
    ["/feed", "feed", "피드"],
    ["/my", "user", "내 정보"],
  ] as const;
  const feed = (
    <>
      <h1 className="page-title">생활 피드</h1>
      <FeedTabs selected={id || "all"} />
      {data?.posts
        .filter(
          (p) =>
            !id ||
            id === "all" ||
            p.category === id.toUpperCase(),
        )
        .map((p) => (
          <PostCard
            key={p.id}
            post={p}
            imageDoubleClickLike={section === "feed" && id === "food"}
          />
        ))}
      {data &&
        !data.posts.some(
          (p) => !id || id === "all" || p.category === id.toUpperCase(),
        ) && (
          <div className="empty mt-3">
            등록된 소식이 없어요.{" "}
            <Link className="icon-btn text-brand" href="/report">
              첫 소식 올리기
            </Link>
          </div>
        )}
      {data?.nextCursor && (
        <button
          className="btn btn-secondary w-full"
          onClick={() => void more().catch((e) => notify(e.message))}
        >
          이전 소식 더 보기
        </button>
      )}
    </>
  );
  return (
    <div className="app">
      {section === "home" && (
        <header className="shrink-0 border-b border-line">
          <div className="mx-auto flex h-13 max-w-295 items-center justify-between px-4 md:px-8">
            <Link href="/" className="font-semibold text-lg">
              햇빛마을20단지
            </Link>
            <Link href="/report" className="hidden text-brand md:inline-flex">
              ＋ 소식 제보
            </Link>
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
          <p className="p-6 text-center text-muted" role="status">
            소식을 불러오는 중…
          </p>
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
      <nav className="bottom-nav" aria-label="하단 주요 메뉴">
        {links.map(([href, icon, label]) => {
          const active =
            href === "/"
              ? section === "home"
              : section === href.slice(1);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={icon} />
              {label}
            </Link>
          );
        })}
      </nav>
      {postId && data && (
        <PostDetail id={postId} onClose={() => hasBackground.current ? router.back() : router.replace("/feed")} />
      )}
      <div role="status" aria-live="polite" className={message ? "toast" : ""}>
        {message}
      </div>
    </div>
  );
}
