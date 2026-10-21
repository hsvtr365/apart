"use client";
import { useState } from "react";
import type { Post } from "@/lib/types";
import { isLongNotice } from "@/lib/notice-kind";

export function NoticeReportFields({ post }: { post?: Post }) {
  const [start, setStart] = useState(post?.noticeStartDate ?? "");
  const [end, setEnd] = useState(post?.noticeEndDate ?? "");
  const [choice, setChoice] = useState(post?.noticeKind ?? "SHORT");
  const automatic = isLongNotice(start, end);
  const kind = automatic ? "ROUTINE" : choice;
  return <div className="grid grid-cols-2 gap-3">
    <label><span className="field">공고 시작일</span>
      <input type="date" name="noticeStartDate" required value={start} onChange={e => setStart(e.target.value)} />
    </label>
    <label><span className="field">공고 종료일</span>
      <input type="date" name="noticeEndDate" required value={end} onChange={e => setEnd(e.target.value)} />
    </label>
    <div className="col-span-2">
      <span className="field" id="notice-kind-label">공고 종류</span>
      <div className="flex gap-6" role="radiogroup" aria-labelledby="notice-kind-label">
        <label className="flex items-center gap-2"><input type="radio" name="noticeKindChoice" value="SHORT" checked={kind === "SHORT"} disabled={automatic} onChange={() => setChoice("SHORT")} />단기공고</label>
        <label className="flex items-center gap-2"><input type="radio" name="noticeKindChoice" value="ROUTINE" checked={kind === "ROUTINE"} disabled={automatic} onChange={() => setChoice("ROUTINE")} />일상공고</label>
      </div>
      <input type="hidden" name="noticeKind" value={kind} />
      <p className="mt-2 text-sm text-slate-500">{automatic ? "게시 기간이 한 달 이상이므로 일상공고로 자동 분류됩니다." : "특정 일정은 단기, 생활규칙·상시 안내는 일상공고를 선택해주세요. 한 달 이상은 자동으로 일상공고가 됩니다."}</p>
    </div>
  </div>;
}
