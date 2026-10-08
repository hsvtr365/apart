"use client";
import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useVillage, request } from "./store";
import { categories, type PostInput } from "@/lib/types";
import { ending } from "@/lib/validation";
import Link from "next/link";
import { KakaoMap, type MapPoint } from "./kakao-map";
const places: Record<string, [number, number]> = {
  정문: [25, 60],
  후문: [12, 25],
  중앙광장: [55, 25],
  "103동": [75, 65],
  "관리사무소 앞": [65, 45],
};
export function Report() {
  const { data, create, notify, busy } = useVillage();
  const router = useRouter();
  const [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [image, setImage] = useState<string | null>(null),
    [uploading, setUploading] = useState(false),
    [place, setPlace] = useState("정문"),
    [point, setPoint] = useState<[number, number]>(places["정문"]),
    [map, setMap] = useState(false),
    [geo, setGeo] = useState<MapPoint | null>(null),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  async function upload(f: File) {
    if (!f.type.startsWith("image/") || f.size > 8 * 1024 * 1024) {
      setError("8MB 이하의 사진을 선택해주세요.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      if (data?.mode === "demo") {
        const url = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(String(reader.result));
          reader.onerror = rej;
          reader.readAsDataURL(f);
        });
        setImage(url);
      } else {
        const form = new FormData();
        form.set("file", f);
        const result = await request<{ url: string }>("/api/uploads", {
          method: "POST",
          body: form,
        });
        setImage(result.url);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fields = new FormData(e.currentTarget);
    try {
      const end = ending(
        String(fields.get("endDate") || "") || null,
        String(fields.get("endTime") || "") || null,
      );
      const input: PostInput = {
        title: title.trim(),
        body: text.trim(),
        category: fields.get("category") as PostInput["category"],
        place,
        mapX: data?.mode === "demo" ? point[0] : null,
        mapY: data?.mode === "demo" ? point[1] : null,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        imageUrl: image,
        endDate: end.endDate,
        endTime: end.endTime,
      };
      if (!input.title || !input.body)
        throw new Error("제목과 내용을 입력해주세요.");
      await create(input);
      notify("소식을 올렸어요.");
      router.push("/feed/" + input.category.toLowerCase());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <h1 className="page-title">제보하기</h1>
      {!data?.user ? (
        <div className="empty">
          <p>로그인하고 이웃에게 소식을 전해주세요.</p>
          <Link href="/my" className="btn mt-3">
            로그인하기
          </Link>
        </div>
      ) : (
        <form className="panel" onSubmit={submit}>
          <label className="field mt-0" htmlFor="report-title">
            제목 <small>{title.length}/15</small>
          </label>
          <input
            id="report-title"
            maxLength={15}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 붕어빵 트럭"
          />
          <label className="field" htmlFor="report-body">
            내용 <small>{text.length}/500</small>
          </label>
          <textarea
            id="report-body"
            rows={4}
            maxLength={500}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="어디서 무슨 일이 있었나요?"
          />
          <label className="my-3 flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed border-line bg-soft p-3">
            <span>{uploading ? "사진 업로드 중…" : "사진 추가 · 선택"}</span>
            <small>8MB 이하</small>
            <input
              ref={file}
              className="mt-2 max-w-full text-xs"
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            {image && (
              <img
                className="mt-2 max-h-44 object-contain"
                src={image}
                alt="첨부 사진 미리보기"
              />
            )}
          </label>
          {image && (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setImage(null);
                if (file.current) file.current.value = "";
              }}
            >
              사진 제거
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="field">카테고리</span>
              <select name="category">
                {Object.entries(categories).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field">장소</span>
              <select
                value={place}
                onChange={(e) => {
                  setPlace(e.target.value);
                  setPoint(places[e.target.value] || point);
                  setGeo(null);
                }}
              >
                {Object.keys(places).map((p) => (
                  <option key={p}>{p}</option>
                ))}
                {place === "지도 지정 위치" && <option>지도 지정 위치</option>}
              </select>
            </label>
          </div>
          <button
            className="btn btn-secondary mt-3"
            type="button"
            aria-expanded={map}
            onClick={() => setMap(!map)}
          >
            지도에서 위치 지정
          </button>
          {map && data?.mode !== "demo" && (
            <>
              <div className="location-picker mt-2">
                <KakaoMap point={geo} onPick={setGeo} />
              </div>
              <small className="mt-1 block">
                {geo
                  ? "지도 위치를 선택했어요."
                  : "지도를 눌러 정확한 위치를 선택해주세요. 위치 없이 장소명만 등록할 수도 있어요."}
              </small>
            </>
          )}
          {map && data?.mode === "demo" && (
            <div
              className="location-picker mt-2"
              tabIndex={0}
              role="button"
              aria-label="지도에서 위치 선택. 방향키로도 이동할 수 있습니다."
              onClick={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                setPoint([
                  ((e.clientX - box.left) / box.width) * 100,
                  ((e.clientY - box.top) / box.height) * 100,
                ]);
                setPlace("지도 지정 위치");
              }}
              onKeyDown={(e) => {
                const d: Record<string, [number, number]> = {
                  ArrowLeft: [-3, 0],
                  ArrowRight: [3, 0],
                  ArrowUp: [0, -3],
                  ArrowDown: [0, 3],
                };
                if (d[e.key]) {
                  e.preventDefault();
                  setPoint([
                    Math.max(0, Math.min(100, point[0] + d[e.key][0])),
                    Math.max(0, Math.min(100, point[1] + d[e.key][1])),
                  ]);
                  setPlace("지도 지정 위치");
                }
              }}
            >
              <img src="/map.svg" alt="단지 배치 예시" />
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-brand px-2 py-1 text-white"
                style={{ left: point[0] + "%", top: point[1] + "%" }}
              >
                선택
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0">
              <span className="field">종료일 · 선택</span>
              <input className="min-w-0" type="date" name="endDate" />
            </label>
            <label className="min-w-0">
              <span className="field">종료시간 · 선택</span>
              <input className="min-w-0" type="time" name="endTime" />
            </label>
          </div>
          <small className="mt-2 block">
            등록시간은 자동 기록됩니다. 종료일·시간은 예정 정보입니다.
          </small>
          {error && (
            <p role="alert" className="mt-3 text-red-700">
              {error}
            </p>
          )}
          <button className="btn mt-4 w-full" disabled={busy || uploading}>
            {busy ? "올리는 중…" : "소식 올리기"}
          </button>
        </form>
      )}
    </>
  );
}
