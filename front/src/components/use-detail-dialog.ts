"use client";
import {
  useEffect,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
} from "react";

export function useDetailDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPressed = useRef(false);
  const outside = (
    event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>,
  ) => {
    const box = event.currentTarget.getBoundingClientRect();
    return (
      event.target === event.currentTarget &&
      (event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom)
    );
  };
  useEffect(() => {
    const previous = document.activeElement;
    const element = ref.current;
    if (element) {
      // SSR detail is visible without JavaScript; upgrade it to a modal on hydration.
      if (element.open) element.close();
      element.showModal();
    }
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  return {
    ref,
    onPointerDown: (event: PointerEvent<HTMLDialogElement>) => {
      backdropPressed.current = outside(event);
    },
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      if (backdropPressed.current && outside(event)) onClose();
      backdropPressed.current = false;
    },
    onCancel: (event: SyntheticEvent<HTMLDialogElement>) => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    },
  };
}
