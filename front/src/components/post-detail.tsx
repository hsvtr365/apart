"use client";
import { useEffect, useRef, useState } from "react";
import { Report } from "./report";
import { useVillage } from "./store";
import { PostCard } from "./post-card";
import { Icon } from "./icons";
import { ImageViewer } from "./image-viewer";
import type { Post } from "@/lib/types";
export function PostDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, detail, act, notify, busy } = useVillage();
  const [post, setPost] = useState<Post | null>(null),
    [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [next, setNext] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropPressed = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);
  useEffect(() => {
    let active = true;
    setError("");
    void detail(id)
      .then((r) => {
        if (active) {
          setPost(r.post);
          setNext(r.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, data]);
  async function loadMore() {
    if (!post || !next) return;
    try {
      const r = await detail(id, next);
      setPost({ ...post, comments: [...post.comments, ...r.post.comments] });
      setNext(r.nextCursor);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="detail-dialog"
      aria-label="게시물 상세"
      onPointerDown={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        backdropPressed.current =
          e.target === e.currentTarget &&
          (e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom);
      }}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        if (
          backdropPressed.current &&
          e.target === e.currentTarget &&
          (e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom)
        )
          close.current();
        backdropPressed.current = false;
      }}
      onCancel={(e) => {
        // File-picker cancellation bubbles to the enclosing dialog in some browsers.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        close.current();
      }}
    >
      <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-line bg-white px-3">
        <b>{editing ? "게시물 수정" : "게시물"}</b>
        {post && (post.authorId === data?.user?.id || data?.user?.permission === 0) && (
          <button
            className="icon-btn ml-auto mr-2 text-brand"
            disabled={busy}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "수정 취소" : "수정"}
          </button>
        )}
        <button className="icon-btn" aria-label="상세 닫기" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {error ? (
        <p role="alert" className="p-6">
          {error}
        </p>
      ) : !post ? (
        <p className="p-6">소식을 불러오는 중…</p>
      ) : editing && post.authorId === data?.user?.id ? (
        <div className="p-4">
          <Report key={post.id} post={post} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <div className={post.imageUrl ? "detail-layout" : ""}>
          {post.imageUrl && <ImageViewer src={post.imageUrl} sources={post.imageUrls} alt={post.title} />}
          <div className="p-4">
            <PostCard post={post} full hideImage />
            <h2 className="mb-2">댓글 {post.commentCount}</h2>
            {!post.comments.length && (
              <p className="py-3 text-muted">첫 댓글을 남겨주세요.</p>
            )}
            {post.comments.map((c) => (
              <div className="border-b border-line py-2" key={c.id}>
                <b>{c.author}</b>
                <p className="whitespace-pre-line break-words">{c.body}</p>
                {c.authorId === data?.user?.id && (
                  <button
                    className="icon-btn text-muted"
                    disabled={busy}
                    onClick={() =>
                      void act("delete-comment", c.id).catch((e) =>
                        notify(e.message),
                      )
                    }
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
            {next && (
              <button
                className="btn btn-secondary mt-2 w-full"
                onClick={() => void loadMore()}
              >
                댓글 더 불러오기
              </button>
            )}
            {data?.user ? (
              <form
                className="mt-3 flex items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!text.trim()) return;
                  try {
                    await act("comment", id, { body: text.trim() });
                    setText("");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                <textarea
                  aria-label="댓글 내용"
                  rows={2}
                  maxLength={500}
                  required
                  placeholder="댓글을 남겨주세요"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button className="btn shrink-0" disabled={busy}>
                  게시
                </button>
              </form>
            ) : (
              <a href="/my" className="btn mt-3">
                로그인하고 댓글 쓰기
              </a>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
