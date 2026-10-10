"use client";
import { useVillage } from "./store";
import { Icon } from "./icons";
import type { Post } from "@/lib/types";
export function Presence({ post, map = false, onConfirmed }: { post: Post; map?: boolean; onConfirmed?: () => void }) {
  const { act, notify, busy } = useVillage();
  if (post.adminDeleted) return null;
  if (map && post.presenceConfirmed) return null;
  return (
    <div className="presence">
      {(["ARRIVED", "GONE"] as const).map((state) => (
        <button
          key={state}
          aria-pressed={post.presence === state}
          disabled={busy}
          onClick={() =>
            void act("presence", post.id, { state })
              .then(() => {
                onConfirmed?.();
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
    </div>
  );
}
