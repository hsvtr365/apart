"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

/** Clickable image preview with a reusable, full-screen viewer. */
export function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const zoomAt = useCallback((factor: number, x = 0, y = 0) => {
    setView((previous) => {
      const scale = Math.max(1, Math.min(6, previous.scale * factor));
      if (scale === 1) return { scale, x: 0, y: 0 };
      const ratio = scale / previous.scale;
      return { scale, x: x - (x - previous.x) * ratio, y: y - (y - previous.y) * ratio };
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element!.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * .002), event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2);
    };
    element?.addEventListener("wheel", onWheel, { passive: false });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      element?.removeEventListener("wheel", onWheel);
      pointers.current.clear();
      element?.close();
    };
  }, [open, zoomAt]);

  return (
    <>
      <button
        type="button"
        className="image-viewer-preview"
        aria-label={`${alt} 크게 보기`}
        onClick={() => {
          setView({ scale: 1, x: 0, y: 0 });
          setOpen(true);
        }}
      >
        <img src={src} alt={alt} />
        <span className="image-viewer-hint" aria-hidden="true">
          <Icon name="expand" /> 크게 보기
        </span>
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <dialog
            ref={dialog}
            className="image-viewer-overlay"
            aria-label={`${alt} 전체 이미지`}
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
            onCancel={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }}
          >
            <button
              type="button"
              className="image-viewer-close"
              aria-label="이미지 닫기"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" />
            </button>
            <img
              src={src}
              alt={alt}
              draggable={false}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, cursor: view.scale > 1 ? "grab" : "zoom-in" }}
              onDoubleClick={() => view.scale > 1 ? setView({ scale: 1, x: 0, y: 0 }) : zoomAt(2)}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              }}
              onPointerMove={(event) => {
                const previous = pointers.current.get(event.pointerId);
                if (!previous) return;
                const point = { x: event.clientX, y: event.clientY };
                const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
                if (other) {
                  const before = Math.hypot(previous.x - other.x, previous.y - other.y);
                  const after = Math.hypot(point.x - other.x, point.y - other.y);
                  const box = dialog.current!.getBoundingClientRect();
                  if (before > 0) zoomAt(after / before, (point.x + other.x) / 2 - box.left - box.width / 2, (point.y + other.y) / 2 - box.top - box.height / 2);
                } else {
                  setView((current) => current.scale > 1 ? { ...current, x: current.x + point.x - previous.x, y: current.y + point.y - previous.y } : current);
                }
                pointers.current.set(event.pointerId, point);
              }}
              onPointerUp={(event) => pointers.current.delete(event.pointerId)}
              onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
            />
            <div className="image-viewer-zoom" aria-label="이미지 확대 조절">
              <button type="button" aria-label="이미지 축소" disabled={view.scale === 1} onClick={() => zoomAt(1 / 1.5)}>−</button>
              <button type="button" aria-label="화면에 맞추기" onClick={() => setView({ scale: 1, x: 0, y: 0 })}>{Math.round(view.scale * 100)}%</button>
              <button type="button" aria-label="이미지 확대" disabled={view.scale === 6} onClick={() => zoomAt(1.5)}>+</button>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
