"use client";
import { useRef, useState } from "react";
import { usePagedList } from "./use-paged-list";
import { useDetailDialog } from "./use-detail-dialog";
import { Report } from "./report";
import { useVillage } from "./store";
import { PostDetailBody } from "./post-detail-body";
import { Icon } from "./icons";
import { PostStatus } from "./post-status";
import { DetailPhotos } from "./detail-photos";
import { LoadingMask } from "./loading-mask";
import type { Post } from "@/lib/types";
export function PostDetail({
  id,
  onClose,
  initialPost,
}: {
  id: string;
  onClose: () => void;
  initialPost?: Post;
}) {
  const { data, detail, act, notify, busy } = useVillage();
  const [editing, setEditing] = useState(false),
    [text, setText] = useState("");
  const {
    page,
    loading,
    error,
    more: loadMore,
  } = usePagedList(id, !!data, data, async (cursor, signal) => {
    const result = await detail(id, cursor, signal);
    return {
      items: result.post.comments,
      nextCursor: result.nextCursor,
      value: result.post,
    };
  });
  const post: Post | null = page
    ? { ...page.value, comments: page.items }
    : (initialPost ?? null);
  const next = page?.nextCursor;
  const dialogProps = useDetailDialog(onClose);
  const close = useRef(onClose);
  close.current = onClose;
  return (
    <dialog
      {...dialogProps}
      open={!!initialPost}
      className="detail-dialog post-detail-dialog"
      aria-label="게시물 상세"
    >
      {!editing && (
        <div className="post-detail-header">
          <h1 className="post-detail-title">{post?.title}</h1>
          {post &&
            !post.adminDeleted &&
            (post.authorId === data?.user?.id ||
              data?.user?.permission === 0) && (
              <div className="ml-auto flex items-center">
                <button
                  className="icon-btn text-brand"
                  disabled={busy}
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "수정 취소" : "수정"}
                </button>
                {data?.user?.permission === 0 &&
                  post.authorId !== data.user.id && (
                    <button
                      className="icon-btn mr-2 text-red-700"
                      disabled={busy}
                      onClick={() =>
                        void act("admin-delete-post", post.id)
                          .then(() => {
                            setEditing(false);
                            notify("관리자 삭제처리했습니다.");
                          })
                          .catch((e) => notify(e.message))
                      }
                    >
                      관리자 삭제
                    </button>
                  )}
              </div>
            )}
          <button className="icon-btn" aria-label="상세 닫기" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      )}
      {post?.adminDeleted && (
        <p role="status" className="px-3 py-2 text-red-700">
          관리자가 삭제처리한 게시물입니다. 상세 열람만 가능합니다.
        </p>
      )}
      {error ? (
        <p role="alert" className="p-6">
          {error}
        </p>
      ) : !post ? (
        <LoadingMask />
      ) : editing &&
        (post.authorId === data?.user?.id || data?.user?.permission === 0) ? (
        <div className="detail-edit">
          <Report
            key={post.id}
            post={post}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
            onDelete={
              post.authorId === data?.user?.id
                ? () => {
                    if (
                      !window.confirm(
                        "이 게시물을 삭제할까요? 삭제 후 공개 목록에서 사라집니다.",
                      )
                    )
                      return;
                    void act("delete-post", post.id)
                      .then(() => {
                        notify("게시물을 삭제했습니다.");
                        close.current();
                      })
                      .catch((e) => notify(e.message));
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="detail-layout redesigned-detail">
          <div className="detail-primary">
            {post.imageUrl && <DetailPhotos post={post} />}
            <PostDetailBody post={post} />
          </div>
          <div className="detail-secondary">
            <PostStatus post={post} />
            <div className="detail-comments">
              <h2>
                댓글 <span>{post.commentCount}</span>
              </h2>
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
                        onClick={() =>
                          void act("delete-comment", c.id).catch((e) =>
                            notify(e.message),
                          )
                        }
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
                  disabled={loading}
                  onClick={() => void loadMore()}
                >
                  댓글 더 불러오기
                </button>
              )}
              {!post.adminDeleted &&
                (data?.user ? (
                  <form
                    className="detail-comment-form"
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
                      placeholder="현장 정보나 후기를 남겨주세요"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                    <button className="btn shrink-0" disabled={busy}>
                      등록
                    </button>
                  </form>
                ) : (
                  <a href="/my" className="btn mt-3">
                    로그인하고 댓글 쓰기
                  </a>
                ))}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
