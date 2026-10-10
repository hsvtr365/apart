"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

/** Clickable image preview with a reusable, full-screen viewer. */
export function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      element?.close();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="image-viewer-preview"
        aria-label={`${alt} 크게 보기`}
        onClick={() => setOpen(true)}
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
            <img src={src} alt={alt} />
          </dialog>,
          document.body,
        )}
    </>
  );
}
