"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Bootstrap, Post, PostInput, Comment } from "@/lib/types";
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
type Store = {
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
  ) => Promise<{ post: Post; nextCursor: string | null }>;
  more: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try {
      const value = await request<Bootstrap>("/api/bootstrap");
      setData(value);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void reload();
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
        }
        if (kind === "edit-post" && p) {
          if (p.adminDeleted) throw new Error("관리자가 삭제처리한 글은 수정할 수 없습니다.");
          if (p.authorId !== next.user!.id && next.user!.permission !== 0)
            throw new Error("본인 글만 수정할 수 있어요.");
          Object.assign(p, payload as PostInput);
        }
        if (kind === "admin-delete-post" && p) {
          if (next.user!.permission !== 0) throw new Error("관리자 권한이 필요합니다.");
          p.adminDeleted = true;
        }
        if (kind === "delete-post" && p) {
          if (p.authorId !== next.user!.id) throw new Error("본인 글만 삭제할 수 있어요.");
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
      await reload();
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
  async function detail(id: string, cursor?: string) {
    if (data?.mode === "demo") {
      const p = data.posts.find((p) => p.id === id);
      if (!p) throw new Error("삭제되었거나 없는 글입니다.");
      return { post: p, nextCursor: null };
    }
    const p = await request<Post & { nextCursor: string | null }>(
      `/api/posts/${id}${cursor ? "?cursor=" + encodeURIComponent(cursor) : ""}`,
    );
    return { post: p, nextCursor: p.nextCursor };
  }
  async function more() {
    if (!data?.nextCursor) return;
    const result = await request<{ posts: Post[]; nextCursor: string | null }>(
      "/api/posts?cursor=" + encodeURIComponent(data.nextCursor),
    );
    setData({
      ...data,
      posts: [
        ...data.posts,
        ...result.posts.filter((p) => !data.posts.some((x) => x.id === p.id)),
      ],
      nextCursor: result.nextCursor,
    });
  }
  return (
    <Context.Provider
      value={{
        data,
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
