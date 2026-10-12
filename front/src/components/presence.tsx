"use client";
import { useId, useState } from "react";
import { Eye } from "lucide-react";
import { useVillage } from "./store";
import { Icon } from "./icons";
import type { Post } from "@/lib/types";
import { PresenceHistoryDialog } from "./presence-history";
export function Presence({
  post,
  map = false,
}: {
  post: Post;
  map?: boolean;
}) {
  const { act, notify, busy } = useVillage();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (post.adminDeleted || post.userDeleted) return null;
  return (
    <div className="presence-wrapper">
      <div className="presence">
        {(!map || !post.presenceConfirmed) &&
          (["ARRIVED", "GONE"] as const).map((state) => (
            <button
              type="button"
              className={`presence-state presence-${state.toLowerCase()}`}
              key={state}
              aria-pressed={post.presence === state}
              disabled={busy}
              onClick={() =>
                void act("presence", post.id, { state })
                  .then(() => {
                    notify("현장 상태를 반영했어요.");
                  })
                  .catch((e) => notify(e.message))
              }
            >
              {map && (
                <Icon
                  name={state === "ARRIVED" ? "check" : "close"}
                  strokeWidth="2.5"
                />
              )}
              {state === "ARRIVED" ? (map ? "있어요" : "왔어요") : "갔어요"}
            </button>
          ))}
        <button
          type="button"
          className="presence-history-toggle"
          aria-label="왔어요·갔어요 기록 보기"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <Eye size={20} aria-hidden="true" />
        </button>
      </div>
      {open && <PresenceHistoryDialog post={post} panelId={panelId} onClose={() => setOpen(false)} />}
    </div>
  );
}
