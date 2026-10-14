"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Bootstrap, Post, PostInput, Comment } from "@/lib/types";
import { todayContext } from "@/lib/map-filter";
import { presenceOccurrence } from "@/lib/presence";
export async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "요청을 처리하지 못했어요.");
  return data;
}
type Feed = { posts: Post[]; nextCursor: string | null; pages: number };
type Store = {
  feeds: Record<string, Feed>;
  loadFeed: (category: string) => Promise<void>;
  revision: number;
  updatedPost: Post | null;
  now: number;
  data: Bootstrap | null;
  error: string;
  message: string;
  busy: boolean;
  reload: () => Promise<void>;
  notify: (s: string) => void;
  act: (kind: string, id?: string, payload?: unknown) => Promise<void>;
  create: (input: PostInput) => Promise<string>;
  detail: (
    id: string,
    cursor?: string,
    signal?: AbortSignal,
  ) => Promise<{ post: Post; nextCursor: string | null }>;
  more: (category?: string) => Promise<void>;
};
function feedUrl(category: string, cursor?: string) {
  const params = new URLSearchParams();
  if (category !== "all") params.set("category", category.toUpperCase());
  if (cursor) params.set("cursor", cursor);
  return "/api/posts?" + params;
}
const Context = createContext<Store | null>(null);
export function Provider({
  children,
  initialData,
  initialNow,
}: {
  children: ReactNode;
  initialData: Bootstrap;
  initialNow: number;
}) {
  const [data, setData] = useState<Bootstrap | null>(initialData),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [feeds, setFeeds] = useState<Record<string, Feed>>({
    all: {
      posts: initialData.posts,
      nextCursor: initialData.nextCursor,
      pages: 1,
    },
  });
  const [revision, setRevision] = useState(0);
  const [updatedPost, setUpdatedPost] = useState<Post | null>(null);
  const [now, setNow] = useState(initialNow);
  const feedRef = useRef(feeds);
  const dataRef = useRef(data);
  dataRef.current = data;
  const refreshedDay = useRef(todayContext().today);
  const lastRefresh = useRef(0);
  // Serialize page loads and refreshes so older responses cannot replace newer actions.
  const pending = useRef(Promise.resolve());
  const enqueue = useCallback((work: () => Promise<void>) => {
    const result = pending.current.then(work);
    pending.current = result.catch(() => {});
    return result;
  }, []);
  const saveFeeds = useCallback((value: Record<string, Feed>) => {
    feedRef.current = value;
    setFeeds(value);
  }, []);
  const reload = useCallback(
    () =>
      enqueue(async () => {
        try {
          const day = todayContext().today;
          const value = await request<Bootstrap>("/api/bootstrap");
          if (value.mode === "demo") {
            if (!dataRef.current) setData(value);
            return;
          }
          const caches: Record<string, Feed> = {};
          const keys = new Set(["all", ...Object.keys(feedRef.current)]);
          for (const category of keys) {
            const previous = feedRef.current[category];
            const pages = previous?.pages ?? 1;
            let page =
              category === "all"
                ? value
                : await request<Feed>(
                    "/api/posts?category=" + category.toUpperCase(),
                  );
            const posts = [...page.posts];
            let loaded = 1;
            while (loaded < pages && page.nextCursor) {
              page = await request<Feed>(feedUrl(category, page.nextCursor));
              posts.push(
                ...page.posts.filter(
                  (p) => !posts.some((existing) => existing.id === p.id),
                ),
              );
              loaded++;
            }
            caches[category] = {
              posts,
              nextCursor: page.nextCursor,
              pages: loaded,
            };
          }
          saveFeeds(caches);
          setData({
            ...value,
            posts: caches.all.posts,
            nextCursor: caches.all.nextCursor,
          });
          refreshedDay.current = day;
          lastRefresh.current = Date.now();
          setNow(Date.now());
          setRevision((value) => value + 1);
          setError("");
        } catch (e) {
          if (dataRef.current)
            setMessage("새로고침 실패: " + (e as Error).message);
          else setError((e as Error).message);
        }
      }),
    [enqueue, saveFeeds],
  );
  const loadFeed = useCallback(
    (category: string) =>
      enqueue(async () => {
        if (
          !dataRef.current ||
          dataRef.current.mode === "demo" ||
          feedRef.current[category]
        )
          return;
        const page = await request<Feed>(feedUrl(category));
        saveFeeds({ ...feedRef.current, [category]: { ...page, pages: 1 } });
      }),
    [enqueue, saveFeeds],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const refresh = (reentry = false) => {
      setNow(Date.now());
      if (document.hidden || dataRef.current?.mode !== "live") return;
      const posts = [
        ...dataRef.current.posts,
        ...(dataRef.current.todayPosts ?? []),
      ];
      if (
        todayContext().today !== refreshedDay.current ||
        (reentry && Date.now() - lastRefresh.current > 15_000) ||
        posts.some(
          (post) =>
            post.presenceOccurrence &&
            post.presenceOccurrence !== presenceOccurrence(post),
        )
      )
        void reload();
    };
    const onVisible = () => refresh(true);
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [reload]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(t);
  }, [message]);
  async function act(kind: string, id = "", payload: unknown = {}) {
    if (!data) throw new Error("소식을 불러온 뒤 다시 시도해주세요.");
    if (!data?.user && kind !== "presence")
      throw new Error("내 정보에서 카카오 로그인 후 이용해주세요.");
    setBusy(true);
    try {
      if (data.mode === "demo") {
        const next = structuredClone(data);
        const p = next.posts.find((p) => p.id === id);
        const value = payload as Record<string, string | boolean>;
        if (kind === "profile") {
          next.user = {
            ...next.user!,
            nickname: String(value.nickname),
            building: String(value.building || ""),
          };
          next.posts.forEach((p) => {
            if (p.authorId === next.user!.id) {
              p.author = next.user!.nickname;
              p.authorBuilding = next.user!.building;
            }
            p.comments.forEach((c) => {
              if (c.authorId === next.user!.id) c.author = next.user!.nickname;
            });
          });
        }
        if (kind === "like" && p) {
          p.liked = !!value.liked;
          p.likes += p.liked ? 1 : -1;
        }
        if (kind === "presence" && p) {
          p.presenceConfirmed = true;
          p.presence = value.state as Post["presence"];
          p.observedAt = new Date().toISOString();
          p.presenceOccurrence = presenceOccurrence(p);
          p.presenceHistory = [
            {
              id: crypto.randomUUID(),
              nickname: next.user?.nickname ?? "방문자 DEMO",
              state: p.presence!,
              observedAt: p.observedAt,
              occurrence: p.presenceOccurrence,
            },
            ...(p.presenceHistory ?? []),
          ];
        }
        if (kind === "edit-post" && p) {
          if (p.adminDeleted)
            throw new Error("관리자가 삭제처리한 글은 수정할 수 없습니다.");
          if (p.authorId !== next.user!.id && next.user!.permission !== 0)
            throw new Error("본인 글만 수정할 수 있어요.");
          Object.assign(p, payload as PostInput);
        }
        if (kind === "admin-delete-post" && p) {
          if (next.user!.permission !== 0)
            throw new Error("관리자 권한이 필요합니다.");
          p.adminDeleted = true;
        }
        if (kind === "delete-post" && p) {
          if (p.authorId !== next.user!.id)
            throw new Error("본인 글만 삭제할 수 있어요.");
          p.userDeleted = true;
        }
        if (kind === "comment" && p) {
          p.comments.push({
            id: crypto.randomUUID(),
            body: String(value.body),
            authorId: next.user!.id,
            author: next.user!.nickname,
            createdAt: new Date().toISOString(),
          });
          p.commentCount++;
        }
        if (kind === "delete-comment")
          next.posts.forEach((p) => {
            p.comments = p.comments.filter(
              (c) => c.id !== id || c.authorId !== next.user!.id,
            );
            p.commentCount = p.comments.length;
          });
        if (kind === "read")
          next.notifications.forEach((n) => {
            if (!id || n.id === id) n.readAt = new Date().toISOString();
          });
        if (kind === "logout") next.user = null;
        setData(next);
        return;
      }
      const config: Record<string, [string, string, unknown]> = {
        profile: ["/api/profile", "PATCH", payload],
        "edit-post": [`/api/posts/${id}`, "PATCH", payload],
        "admin-delete-post": [`/api/posts/${id}/admin-delete`, "PATCH", {}],
        "delete-post": [`/api/posts/${id}`, "DELETE", {}],
        like: [`/api/posts/${id}/like`, "PUT", payload],
        presence: [`/api/posts/${id}/presence`, "PUT", payload],
        comment: [`/api/posts/${id}/comments`, "POST", payload],
        "delete-comment": [`/api/comments/${id}`, "DELETE", {}],
        read: ["/api/notifications", "PATCH", id ? { id } : {}],
        logout: ["/api/auth/logout", "POST", {}],
      };
      const [url, method, body] = config[kind];
      await request(url, { method, body: JSON.stringify(body) });
      if (["like", "presence", "comment"].includes(kind)) {
        await enqueue(async () => {
          const post = await request<Post>(`/api/posts/${id}`);
          const replace = (posts: Post[]) =>
            posts.map((old) => (old.id === id ? post : old));
          const caches = Object.fromEntries(
            Object.entries(feedRef.current).map(([key, feed]) => [
              key,
              { ...feed, posts: replace(feed.posts) },
            ]),
          );
          saveFeeds(caches);
          setData((value) =>
            value
              ? {
                  ...value,
                  posts: replace(value.posts),
                  todayPosts: replace(value.todayPosts ?? []),
                }
              : value,
          );
          setUpdatedPost(post);
        });
      } else if (kind === "read") {
        setData((value) =>
          value
            ? {
                ...value,
                notifications: value.notifications.map((n) =>
                  !id || n.id === id
                    ? { ...n, readAt: new Date().toISOString() }
                    : n,
                ),
              }
            : value,
        );
      } else await reload();
    } finally {
      setBusy(false);
    }
  }
  async function create(input: PostInput) {
    if (!data?.user) throw new Error("로그인 후 소식을 올릴 수 있어요.");
    setBusy(true);
    try {
      if (data.mode === "demo") {
        const id = crypto.randomUUID();
        const p: Post = {
          ...input,
          id,
          createdAt: new Date().toISOString(),
          authorId: data.user.id,
          author: data.user.nickname,
          authorBuilding: data.user.building,
          likes: 0,
          liked: false,
          commentCount: 0,
          comments: [],
          presence: null,
          observedAt: null,
        };
        setData({ ...data, posts: [p, ...data.posts] });
        return id;
      }
      const result = await request<{ id: string }>("/api/posts", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await reload();
      return result.id;
    } finally {
      setBusy(false);
    }
  }
  async function detail(id: string, cursor?: string, signal?: AbortSignal) {
    if (data?.mode === "demo") {
      const p = data.posts.find((p) => p.id === id);
      if (!p) throw new Error("삭제되었거나 없는 글입니다.");
      return { post: p, nextCursor: null };
    }
    const p = await request<Post & { nextCursor: string | null }>(
      `/api/posts/${id}${cursor ? "?cursor=" + encodeURIComponent(cursor) : ""}`,
      { signal },
    );
    return { post: p, nextCursor: p.nextCursor };
  }
  function more(category = "all") {
    return enqueue(async () => {
      const current = feedRef.current[category];
      if (!current?.nextCursor) return;
      const result = await request<Feed>(feedUrl(category, current.nextCursor));
      const next = {
        posts: [
          ...current.posts,
          ...result.posts.filter(
            (p) => !current.posts.some((x) => x.id === p.id),
          ),
        ],
        nextCursor: result.nextCursor,
        pages: current.pages + 1,
      };
      saveFeeds({ ...feedRef.current, [category]: next });
      if (category === "all")
        setData((value) =>
          value
            ? { ...value, posts: next.posts, nextCursor: next.nextCursor }
            : value,
        );
    });
  }
  return (
    <Context.Provider
      value={{
        data,
        feeds,
        loadFeed,
        revision,
        updatedPost,
        now,
        error,
        message,
        busy,
        reload,
        notify: setMessage,
        act,
        create,
        detail,
        more,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useVillage() {
  const value = useContext(Context);
  if (!value) throw new Error("Provider required");
  return value;
}
