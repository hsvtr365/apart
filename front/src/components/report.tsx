"use client";
import { useState, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVillage, request } from "./store";
import {
  categories,
  weekdayLabels,
  seasonLabels,
  type Post,
  type PostInput,
} from "@/lib/types";
import { KakaoMap, type MapPoint } from "./kakao-map";
import { TimePicker } from "./time-picker";
import { Building2, Check, ImagePlus, ShoppingBasket, Square, SquareCheck, Store, X } from "lucide-react";
export function Report({ post, onDone }: { post?: Post; onDone?: () => void }) {
  const { data, create, act, notify, busy } = useVillage();
  const router = useRouter();
  const params = useSearchParams();
  const [title, setTitle] = useState(post?.title ?? ""),
    [text, setText] = useState(post?.body ?? ""),
    [images, setImages] = useState<string[]>(
      post?.imageUrls ?? (post?.imageUrl ? [post.imageUrl] : []),
    ),
    [uploading, setUploading] = useState(false),
    [point, setPoint] = useState<[number, number]>([
      post?.mapX ?? 25,
      post?.mapY ?? 60,
    ]),
    [geo, setGeo] = useState<MapPoint | null>(
      post?.latitude != null && post.longitude != null
        ? { latitude: post.latitude, longitude: post.longitude }
        : null,
    ),
    [error, setError] = useState("");
  const [scheduleType, setScheduleType] = useState<"WEEKLY" | "ONCE">(
    post?.scheduleType ?? "WEEKLY",
  );
  const file = useRef<HTMLInputElement>(null);
  async function upload(files: File[]) {
    if (images.length + files.length > 6) {
      setError("사진은 최대 6장까지 첨부할 수 있어요.");
      return;
    }
    if (
      files.some(
        (f) => !f.type.startsWith("image/") || f.size > 8 * 1024 * 1024,
      )
    ) {
      setError("8MB 이하의 사진을 선택해주세요.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      for (const f of files) {
        if (data?.mode === "demo") {
          const url = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(String(reader.result));
            reader.onerror = rej;
            reader.readAsDataURL(f);
          });
          setImages((current) => [...current, url]);
        } else {
          const form = new FormData();
          form.set("file", f);
          const result = await request<{ url: string }>("/api/uploads", {
            method: "POST",
            body: form,
          });
          setImages((current) => [...current, result.url]);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fields = new FormData(e.currentTarget);
    try {
      const input: PostInput = {
        title: title.trim(),
        body: text.trim(),
        category: fields.get("category") as PostInput["category"],
        mapX: data?.mode === "demo" ? point[0] : null,
        mapY: data?.mode === "demo" ? point[1] : null,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        imageUrl: images[0] ?? null,
        imageUrls: images,
        scheduleType,
        startDate: String(fields.get("startDate") || "") || null,
        finishDate: String(fields.get("finishDate") || "") || null,
        weekdays: fields.getAll("weekdays").map(Number),
        seasons: fields.getAll("seasons").map(String),
        arrivalTime: String(fields.get("arrivalTime") || "") || null,
        departureTime: String(fields.get("departureTime") || "") || null,
      };
      if (!input.title || !input.body)
        throw new Error("제목과 내용을 입력해주세요.");
      if (post) {
        await act("edit-post", post.id, input);
        notify("소식을 수정했어요.");
        onDone?.();
        return;
      }
      await create(input);
      notify("소식을 올렸어요.");
      router.push("/feed/" + input.category.toLowerCase());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <header className="report-header">
        <h1>{post ? "게시물 수정" : "제보하기"}</h1>
        {data?.user && (
          <button className="btn report-submit" type="submit" form="report-form" disabled={busy || uploading}>
            {busy ? "저장 중…" : post ? "수정 저장" : "소식 올리기"}
          </button>
        )}
      </header>
      {params.get("login") === "failed" && !data?.user && (
        <p role="alert" className="mb-3 text-red-700">
          로그인을 완료하지 못했어요. 다시 시도해주세요.
        </p>
      )}
      {!data?.user ? (
        <div className="empty">
          <p>로그인하고 이웃에게 소식을 전해주세요.</p>
          <p className="mt-1 text-muted">
            처음 로그인하면 자동으로 가입됩니다.
          </p>
          {data?.kakaoReady ? (
            <a
              href="/api/auth/kakao?next=%2Freport"
              className="btn mt-3 bg-[#fee500] text-ink"
            >
              카카오로 로그인하고 제보하기
            </a>
          ) : (
            <p className="mt-3 text-muted">카카오 로그인 연결 준비 중입니다.</p>
          )}
        </div>
      ) : (
        <form id="report-form" onSubmit={submit}>
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
          <div className="report-photos">
            <label className="field" htmlFor="report-images">
              사진 · 선택 <small>{images.length}/6 · 장당 8MB 이하</small>
            </label>
            <input
              id="report-images"
              ref={file}
              type="file"
              hidden
              accept="image/*"
              multiple
              disabled={uploading || images.length === 6}
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                e.currentTarget.value = "";
                if (selected.length) void upload(selected);
              }}
            />
            <button
              type="button"
              className="report-photo-select"
              disabled={uploading || images.length === 6}
              onClick={() => file.current?.click()}
            >
              <ImagePlus size={22} strokeWidth={1.8} aria-hidden="true" />
              {uploading ? "업로드 중…" : images.length === 6 ? "사진 6장 첨부 완료" : "사진 선택"}
            </button>
            {uploading && <small role="status">사진 업로드 중…</small>}
            <div className="report-photo-grid">
              {images.map((url, index) => (
                <div className="report-photo" key={url}>
                  <img src={url} alt={`첨부 사진 ${index + 1}`} />
                  <button
                    type="button"
                    disabled={uploading}
                    aria-label={`사진 ${index + 1} 삭제`}
                    onClick={() =>
                      setImages((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <fieldset className="mt-3">
            <legend className="field">카테고리</legend>
            <div className="choice-row">
              {Object.entries(categories).map(([value, label]) => {
                const CategoryIcon = value === "FOOD" ? ShoppingBasket : value === "NOTICE" ? Building2 : Store;
                return (
                <label className="choice-chip" key={value}>
                  <input
                    type="radio"
                    name="category"
                    value={value}
                    defaultChecked={(post?.category ?? "FOOD") === value}
                  />
                  <span><span className="category-state"><CategoryIcon className="category-icon" size={20} strokeWidth={1.8} aria-hidden="true" /><Check className="category-check" size={20} strokeWidth={2} aria-hidden="true" /></span>{label}</span>
                </label>
                );
              })}
            </div>
          </fieldset>
          {data?.mode !== "demo" && (
            <>
              <div className="location-picker mt-2">
                <KakaoMap point={geo} onPick={setGeo} />
              </div>
              <small className="mt-1 block">
                {geo
                  ? "지도 위치를 선택했어요."
                  : "지도를 눌러 위치를 선택해주세요."}
              </small>
            </>
          )}
          {data?.mode === "demo" && (
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
          <fieldset className="mt-3">
            <legend className="field">방문 일정</legend>
            <div className="choice-row">
              {(
                [
                  ["WEEKLY", "매주"],
                  ["ONCE", "1회"],
                ] as const
              ).map(([value, label]) => (
                <label className="choice-chip" key={value}>
                  <input
                    type="radio"
                    name="scheduleType"
                    value={value}
                    checked={scheduleType === value}
                    onChange={() => setScheduleType(value)}
                  />
                  <span>{label}<Square className="choice-square" size={18} aria-hidden="true" /><SquareCheck className="choice-square-checked" size={18} aria-hidden="true" /></span>
                </label>
              ))}
            </div>
          </fieldset>
          {scheduleType === "WEEKLY" && (
            <fieldset className="mt-3">
              <legend className="field">오는 요일 · 선택</legend>
              <div className="choice-row">
                {weekdayLabels.map((label, day) => (
                  <label key={day} className="choice-chip">
                    <input
                      type="checkbox"
                      name="weekdays"
                      value={day}
                      defaultChecked={post?.weekdays.includes(day)}
                    />
                    <span>{label}<Square className="choice-square" size={18} aria-hidden="true" /><SquareCheck className="choice-square-checked" size={18} aria-hidden="true" /></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {scheduleType === "ONCE" && (
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="field">열리는 날</span>
                <input
                  type="date"
                  name="startDate"
                  required
                  defaultValue={post?.startDate ?? ""}
                />
              </label>
              <label>
                <span className="field">가는 날 · 선택</span>
                <input
                  type="date"
                  name="finishDate"
                  defaultValue={post?.finishDate ?? ""}
                />
              </label>
            </div>
          )}
          <TimePicker
            arrival={post?.arrivalTime ?? null}
            departure={post?.departureTime ?? null}
          />
          {scheduleType === "WEEKLY" && (
            <fieldset className="mt-3">
              <legend className="field">오는 계절 · 선택</legend>
              <div className="choice-row">
                {Object.entries(seasonLabels).map(([value, label]) => (
                  <label key={value} className="choice-chip">
                    <input
                      type="checkbox"
                      name="seasons"
                      value={value}
                      defaultChecked={post?.seasons.includes(value)}
                    />
                    <span>{label}<Square className="choice-square" size={18} aria-hidden="true" /><SquareCheck className="choice-square-checked" size={18} aria-hidden="true" /></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <small className="mt-2 block text-muted">요일·시간·계절은 아는 정보만 선택해주세요.</small>
          {error && (
            <p role="alert" className="mt-3 text-red-700">
              {error}
            </p>
          )}
        </form>
      )}
    </>
  );
}
