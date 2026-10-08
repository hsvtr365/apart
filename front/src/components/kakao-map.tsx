/// <reference types="kakao.maps.d.ts" />
"use client";
import Script from "next/script";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/types";
import { Presence } from "./post-card";

export type MapPoint = { latitude: number; longitude: number };
function Pin({
  map,
  post,
  selected,
}: {
  map: kakao.maps.Map;
  post: Post;
  selected?: boolean;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const content = document.createElement("div");
    const overlay = new kakao.maps.CustomOverlay({
      map,
      content,
      clickable: true,
      position: new kakao.maps.LatLng(post.latitude!, post.longitude!),
      yAnchor: 1.1,
      zIndex: selected ? 2 : 1,
    });
    setNode(content);
    return () => overlay.setMap(null);
  }, [map, post.latitude, post.longitude, selected]);
  return (
    node &&
    createPortal(
      <div className={"map-pin geo-pin " + (selected ? "selected" : "")}>
        <small>{post.place}</small>
        <Link
          href={"/post/" + post.id}
          className="flex min-h-11 items-center font-semibold"
        >
          {post.title}
        </Link>
        {post.category === "FOOD" && <Presence post={post} />}
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
        instance.addControl(
          new kakao.maps.ZoomControl(),
          kakao.maps.ControlPosition.RIGHT,
        );
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
        <p role="status" className="absolute left-3 top-20 bg-white p-3">
          지도를 불러오는 중…
        </p>
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
            <Pin key={p.id} map={map} post={p} selected={p.id === selected} />
          ))}
      {map && onPick && (
        <button
          type="button"
          className="btn btn-secondary absolute bottom-8 left-2 z-10"
          onClick={() => {
            const c = map.getCenter();
            onPick({ latitude: c.getLat(), longitude: c.getLng() });
          }}
        >
          지도 중심 선택
        </button>
      )}
    </>
  );
}
