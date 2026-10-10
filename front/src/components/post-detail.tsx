"use client";
import { useEffect, useRef, useState } from "react";
import { Report } from "./report";
import { useVillage } from "./store";
import { PostDetailBody } from "./post-detail-body";
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
      {!editing && <div className="post-detail-header">
        <h1 className="post-detail-title">{post?.title}</h1>
        {post && !post.adminDeleted && (post.authorId === data?.user?.id || data?.user?.permission === 0) && (
          <div className="ml-auto flex items-center">
            <button
              className="icon-btn text-brand"
              disabled={busy}
              onClick={() => setEditing(!editing)}
            >
              {editing ? "수정 취소" : "수정"}
            </button>
            {data?.user?.permission === 0 && post.authorId !== data.user.id && (
              <button className="icon-btn mr-2 text-red-700" disabled={busy}
                onClick={() => void act("admin-delete-post", post.id)
                  .then(() => { setEditing(false); notify("관리자 삭제처리했습니다."); })
                  .catch(e => notify(e.message))}>관리자 삭제</button>
            )}
          </div>
        )}
        <button className="icon-btn" aria-label="상세 닫기" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>}
      {post?.adminDeleted && <p role="status" className="px-3 py-2 text-red-700">관리자가 삭제처리한 게시물입니다. 상세 열람만 가능합니다.</p>}
      {error ? (
        <p role="alert" className="p-6">
          {error}
        </p>
      ) : !post ? (
        <p className="p-6">소식을 불러오는 중…</p>
      ) : editing && (post.authorId === data?.user?.id || data?.user?.permission === 0) ? (
        <div className="detail-edit">
          <Report key={post.id} post={post} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} onDelete={post.authorId === data?.user?.id ? () => {
            if (!window.confirm("이 게시물을 삭제할까요? 삭제 후 공개 목록에서 사라집니다.")) return;
            void act("delete-post", post.id)
              .then(() => { notify("게시물을 삭제했습니다."); close.current(); })
              .catch(e => notify(e.message));
          } : undefined} />
        </div>
      ) : (
        <div className={post.imageUrl ? "detail-layout" : ""}>
          {post.imageUrl && <ImageViewer src={post.imageUrl} sources={post.imageUrls} alt={post.title} />}
          <div className="detail-body">
            <PostDetailBody post={post} />
            {!post.comments.length && (
              <p className="py-3 text-muted">첫 댓글을 남겨주세요.</p>
            )}
            {post.comments.map((c) => (
              <div className="border-b border-line py-2" key={c.id}>
                <div className="flex items-center justify-between gap-2">
                  <b className="comment-author-name">{c.author}</b>
                  {!post.adminDeleted && c.authorId === data?.user?.id && (
                    <button
                      className="icon-btn comment-delete"
                      aria-label="댓글 삭제"
                      title="댓글 삭제"
                      disabled={busy}
                      onClick={() => void act("delete-comment", c.id).catch((e) => notify(e.message))}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-line break-words">{c.body}</p>
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
            {!post.adminDeleted && (data?.user ? (
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
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}
