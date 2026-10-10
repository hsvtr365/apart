import type { Post } from "@/lib/types";

export function NoticeReportFields({ post }: { post?: Post }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label>
        <span className="field">공고 시작일</span>
        <input
          type="date"
          name="noticeStartDate"
          required
          defaultValue={post?.noticeStartDate ?? ""}
        />
      </label>
      <label>
        <span className="field">공고 종료일</span>
        <input
          type="date"
          name="noticeEndDate"
          required
          defaultValue={post?.noticeEndDate ?? ""}
        />
      </label>
    </div>
  );
}
