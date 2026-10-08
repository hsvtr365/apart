"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useVillage, request } from "./store";
import { categories, type Post } from "@/lib/types";
export function Account() {
  const params = useSearchParams();
  const { data, act, notify, busy } = useVillage();
  const [tab, setTab] = useState("posts"),
    [editing, setEditing] = useState(false),
    [rows, setRows] = useState<Post[]>([]),
    [next, setNext] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!data) return;
    setError("");
    if (data.mode === "demo") {
      const user = data.user;
      setRows(
        data.posts.filter((p) =>
          tab === "liked"
            ? p.liked
            : tab === "comments"
              ? p.comments.some((c) => c.authorId === user?.id)
              : p.authorId === user?.id,
        ),
      );
      setNext(null);
      return;
    }
    if (!data.user || tab === "received") return;
    setLoading(true);
    request<{ posts: Post[]; nextCursor: string | null }>(
      "/api/activity?tab=" + tab,
    )
      .then((r) => {
        if (active) {
          setRows(r.posts);
          setNext(r.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [data, tab]);
  if (!data) return null;
  const user = data.user;
  const tabs = [
    ["posts", "내 글"],
    ["comments", "내 댓글"],
    ["received", "받은 댓글"],
    ["liked", "좋아요"],
  ];
  async function loadMore() {
    if (!next) return;
    try {
      const result = await request<{
        posts: Post[];
        nextCursor: string | null;
      }>("/api/activity?tab=" + tab + "&cursor=" + encodeURIComponent(next));
      setRows([...rows, ...result.posts]);
      setNext(result.nextCursor);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <h1 className="page-title">내 정보</h1>
      {params.get("login") === "failed" && (
        <p role="alert" className="mb-3 text-red-700">
          카카오 로그인을 완료하지 못했어요. 다시 시도해주세요.
        </p>
      )}
      <div className="panel">
        {user ? (
          <>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-soft">
                나
              </span>
              <div>
                <h2>{user.nickname}</h2>
                <small>{user.building || "동 미설정"}</small>
              </div>
              <button
                className="btn btn-secondary ml-auto"
                onClick={() => setEditing(!editing)}
                aria-expanded={editing}
              >
                프로필 수정
              </button>
            </div>
            {editing && (
              <form
                className="mt-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  try {
                    await act("profile", "", {
                      nickname: form.get("nickname"),
                      building: form.get("building") || null,
                    });
                    setEditing(false);
                    notify("프로필을 저장했어요.");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="field">닉네임</span>
                    <input
                      name="nickname"
                      maxLength={12}
                      required
                      defaultValue={user.nickname}
                    />
                  </label>
                  <label>
                    <span className="field">동 · 선택</span>
                    <input
                      name="building"
                      maxLength={8}
                      defaultValue={user.building || ""}
                      placeholder="예: 2001동"
                    />
                  </label>
                </div>
                <small className="mt-2 block">
                  동은 내 정보에만 표시됩니다. 거주 인증을 의미하지 않습니다.
                </small>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setEditing(false)}
                  >
                    취소
                  </button>
                  <button className="btn" disabled={busy}>
                    저장
                  </button>
                </div>
              </form>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <small>
                {data.mode === "demo"
                  ? "예시 프로필 · 새로고침하면 초기화됩니다."
                  : "카카오 계정으로 로그인됨"}
              </small>
              {data.mode === "live" && (
                <button
                  className="icon-btn text-muted"
                  onClick={() =>
                    void act("logout").catch((e) => notify(e.message))
                  }
                >
                  로그아웃
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2>이웃과 소식을 나눠보세요.</h2>
            <p className="mt-2 text-muted">
              카카오 이름과 사진은 공개하지 않아요.
            </p>
            <small className="mt-1 block">
              처음 로그인하면 가입됩니다. 닉네임과 동은 로그인 후 설정해주세요.
            </small>
            {data.kakaoReady ? (
              <a
                className="btn mt-3 w-full bg-[#fee500] text-ink"
                href="/api/auth/kakao"
              >
                카카오로 로그인
              </a>
            ) : (
              <p className="mt-3 rounded-sm bg-soft p-3">
                카카오 로그인 연결 준비 중입니다.
              </p>
            )}
          </>
        )}
      </div>
      {user && (
        <>
          <nav className="tabs mt-4" aria-label="내 활동">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                className="tab"
                aria-pressed={key === tab}
                onClick={() => setTab(key)}
              >
                {label}
                {key === "received" &&
                  data.notifications.some((n) => !n.readAt) && (
                    <span
                      className="size-1.5 rounded-full bg-brand"
                      aria-label="새 댓글 있음"
                    />
                  )}
              </button>
            ))}
          </nav>
          <div className="flex min-h-12 items-center justify-between">
            <b>{tabs.find((t) => t[0] === tab)?.[1]}</b>
            {tab === "received" &&
              data.notifications.some((n) => !n.readAt) && (
                <button
                  className="icon-btn text-brand"
                  disabled={busy}
                  onClick={() =>
                    void act("read").catch((e) => notify(e.message))
                  }
                >
                  모두 읽음
                </button>
              )}
          </div>
          {error && <p role="alert">{error}</p>}
          {loading ? (
            <p className="py-6 text-muted">불러오는 중…</p>
          ) : tab === "received" ? (
            <>
              {data.notifications.map((n) => (
                <Link
                  href={"/post/" + n.postId}
                  className="row"
                  key={n.id}
                  onClick={() =>
                    void act("read", n.id).catch((e) => notify(e.message))
                  }
                >
                  <b>
                    {!n.readAt && <span className="mr-1 text-brand">•</span>}
                    {n.author} · {n.title}
                  </b>
                  <p className="my-1">{n.body}</p>
                  <small>{!n.readAt ? "새 댓글 · " : ""}댓글과 원문 보기</small>
                </Link>
              ))}
              {!data.notifications.length && (
                <div className="empty">
                  내 글에 댓글이 달리면 여기에서 확인할 수 있어요.
                </div>
              )}
            </>
          ) : (
            <>
              {rows.map((p) =>
                tab === "comments" ? (
                  p.comments
                    .filter((c) => c.authorId === user.id)
                    .map((c) => (
                      <Link className="row" key={c.id} href={"/post/" + p.id}>
                        <b>{p.title}</b>
                        <p className="my-1 line-clamp-2">{c.body}</p>
                        <small>댓글과 원문 보기</small>
                      </Link>
                    ))
                ) : (
                  <Link className="row" key={p.id} href={"/post/" + p.id}>
                    <b>{p.title}</b>
                    <p className="my-1 line-clamp-2">{p.body}</p>
                    <small>
                      {categories[p.category]} · {p.place} · 댓글{" "}
                      {p.commentCount}
                    </small>
                  </Link>
                ),
              )}
              {!rows.length && (
                <div className="empty">
                  <p>
                    아직{" "}
                    {tab === "posts"
                      ? "작성한 글이"
                      : tab === "comments"
                        ? "작성한 댓글이"
                        : "좋아요한 글이"}{" "}
                    없어요.
                  </p>
                  <Link
                    href={tab === "posts" ? "/report" : "/feed"}
                    className="icon-btn mt-2 text-brand"
                  >
                    {tab === "posts" ? "소식 작성하기" : "생활 피드 둘러보기"}
                  </Link>
                </div>
              )}
              {next && (
                <button
                  className="btn btn-secondary mt-3 w-full"
                  onClick={() => void loadMore()}
                >
                  더 불러오기
                </button>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
