"use client";
import { useEffect, useRef, useState } from "react";

type InstagramWindow = Window & { instgrm?: { Embeds: { process: () => void } } };
let sdk: Promise<void> | undefined;
function loadInstagram() {
  if ((window as InstagramWindow).instgrm) return Promise.resolve();
  return sdk ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); sdk = undefined; reject(new Error("Instagram embed unavailable")); };
    document.body.appendChild(script);
  });
}

export function InstagramEmbed({ url, name }: { url: string; name: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    void loadInstagram().then(() => {
      if (active) (window as InstagramWindow).instgrm?.Embeds.process();
    }).catch(() => { /* The original account link remains available if the SDK is blocked. */ });
    return () => { active = false; };
  }, [visible]);
  return <div ref={container} className="institution-instagram">
    {visible && <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14">
      <a href={url} target="_blank" rel="noopener noreferrer">{name} 인스타그램에서 보기</a>
    </blockquote>}
  </div>;
}
