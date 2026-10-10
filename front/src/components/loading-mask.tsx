import { LoaderCircle } from "lucide-react";

export function LoadingMask({ overlay = false }: { overlay?: boolean }) {
  return (
    <div className={"loading-mask" + (overlay ? " loading-mask-overlay" : "")} role="status" aria-label="불러오는 중" aria-busy="true">
      <LoaderCircle className="loading-progress" size={28} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
