/// <reference types="kakao.maps.d.ts" />
"use client";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/types";
import { Presence } from "./presence";
import { LoadingMask } from "./loading-mask";
import { Icon } from "./icons";
import { ChevronRight, Minus, Plus } from "lucide-react";

export type MapPoint = { latitude: number; longitude: number };
function Pin({
  map,
  post,
  selected,
  zoomed,
}: {
  map: kakao.maps.Map;
  post: Post;
  selected?: boolean;
  zoomed: boolean;
}) {
  const router = useRouter();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => () => cancelClose(), []);
  const overlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const expanded = zoomed || !!selected || open || hovered;
  useEffect(() => {
    const content = document.createElement("div");
    const overlay = new kakao.maps.CustomOverlay({
      map,
      content,
      clickable: true,
      position: new kakao.maps.LatLng(post.latitude!, post.longitude!),
      // Anchor the coordinate directly; CSS aligns the portal after it renders.
      xAnchor: 0,
      yAnchor: 0,
      zIndex: selected ? 2 : 1,
    });
    overlayRef.current = overlay;
    setNode(content);
    const dismiss = () => setOpen(false);
    kakao.maps.event.addListener(map, "click", dismiss);
    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
      kakao.maps.event.removeListener(map, "click", dismiss);
    };
  }, [map, post.latitude, post.longitude, selected]);
  useEffect(() => {
    overlayRef.current?.setZIndex(hovered || open || selected ? 10 : 1);
  }, [hovered, open, selected]);
  return (
    node &&
    createPortal(
      <div
        className={"map-marker" + (expanded ? " expanded" : "")}
        onMouseEnter={() => {
          cancelClose();
          setHovered(true);
        }}
        onMouseLeave={() => {
          cancelClose();
          closeTimer.current = setTimeout(() => setHovered(false), 200);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            cancelClose();
            setOpen(false);
            setHovered(false);
          }
        }}
      >
        <button
          type="button"
          className="map-marker-button"
          aria-label={post.title + " 위치 정보"}
          aria-expanded={expanded}
          aria-controls={"map-info-" + post.id}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
        >
          <Icon name="pin" width="36" height="36" />
        </button>
        <div
          id={"map-info-" + post.id}
          className="map-pin-card"
          hidden={!expanded}
        >
          <Link
            href={"/post/" + post.id}
            onClickCapture={(event) => {
              event.preventDefault();
              router.push("/post/" + post.id, { scroll: false });
            }}
            className={"map-callout-title " + (selected ? "selected" : "")}
            title={post.title}
          >
            <span>{post.title}</span>
            <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
          </Link>
          {post.category === "FOOD" && !confirmed && !post.presenceConfirmed && (
            <div className="map-callout-actions">
              <Presence post={post} map onConfirmed={() => setConfirmed(true)} />
            </div>
          )}
        </div>
      </div>,
      node,
    )
  );
}

export function KakaoMap({
  posts = [],
  selected,
  point,
  onPick,
}: {
  posts?: Post[];
  selected?: string;
  point?: MapPoint | null;
  onPick?: (point: MapPoint) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [ready, setReady] = useState(false);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const [level, setLevel] = useState(3);
  const [error, setError] = useState("");
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  useEffect(() => {
    if (!ready || !container.current) return;
    let active = true;
    let observer: ResizeObserver | undefined;
    new kakao.maps.services.Geocoder().addressSearch(
      "경기 고양시 덕양구 충장로152번길 39",
      (rows, status) => {
        if (!active || !container.current) return;
        if (status !== kakao.maps.services.Status.OK || !rows[0]) {
          setError("단지 위치를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
          return;
        }
        const center = new kakao.maps.LatLng(
          Number(rows[0].y),
          Number(rows[0].x),
        );
        const instance = new kakao.maps.Map(container.current, {
          center,
          level: 3,
        });
        kakao.maps.event.addListener(
          instance,
          "click",
          (e: { latLng: kakao.maps.LatLng }) => {
            pick.current?.({
              latitude: e.latLng.getLat(),
              longitude: e.latLng.getLng(),
            });
          },
        );
        observer = new ResizeObserver(() => {
          const c = instance.getCenter();
          instance.relayout();
          instance.setCenter(c);
        });
        observer.observe(container.current);
        setMap(instance);
      },
    );
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [ready]);
  useEffect(() => {
    if (!map) return;
    const update = () => setLevel(map.getLevel());
    update();
    kakao.maps.event.addListener(map, "zoom_changed", update);
    return () => kakao.maps.event.removeListener(map, "zoom_changed", update);
  }, [map]);
  useEffect(() => {
    if (!map || !point) return;
    const marker = new kakao.maps.Marker({
      map,
      position: new kakao.maps.LatLng(point.latitude, point.longitude),
    });
    map.panTo(marker.getPosition());
    return () => marker.setMap(null);
  }, [map, point]);
  useEffect(() => {
    const post = posts.find((p) => p.id === selected);
    if (map && post?.latitude != null && post.longitude != null)
      map.panTo(new kakao.maps.LatLng(post.latitude, post.longitude));
  }, [map, selected, posts]);
  return (
    <>
      {key && (
        <Script
          id="kakao-map-sdk"
          src={
            "https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey=" +
            key
          }
          onReady={() => kakao.maps.load(() => setReady(true))}
          onError={() =>
            setError("지도를 불러오지 못했어요. 연결 상태를 확인해주세요.")
          }
        />
      )}
      <div
        ref={container}
        className="absolute inset-0"
        aria-label="햇빛마을20단지 카카오 지도"
      />
      {(!key || error) && (
        <p
          role="alert"
          className="absolute left-3 right-3 top-20 z-10 bg-white p-3"
        >
          {error || "지도 키가 설정되지 않았어요."}
        </p>
      )}
      {key && !map && !error && (
        <LoadingMask overlay />
      )}
      {map &&
        posts
          .filter(
            (p) =>
              p.category !== "NOTICE" &&
              p.latitude != null &&
              p.longitude != null,
          )
          .map((p) => (
            <Pin
              key={p.id}
              map={map}
              post={p}
              selected={p.id === selected}
              zoomed={level <= 3}
            />
          ))}
      {map && (
        <div className="map-zoom" aria-label="지도 크기 조절" onPointerDown={event => event.stopPropagation()}>
          <button type="button" aria-label="지도 확대" disabled={level <= 1} onClick={() => map.setLevel(level - 1)}><Plus aria-hidden="true" /></button>
          <input type="range" aria-label="지도 확대 수준" min={1} max={14} value={15 - level} onChange={event => map.setLevel(15 - Number(event.target.value))} />
          <button type="button" aria-label="지도 축소" disabled={level >= 14} onClick={() => map.setLevel(level + 1)}><Minus aria-hidden="true" /></button>
        </div>
      )}
    </>
  );
}
