"use client";
import { useState } from "react";
import { Square, SquareCheck } from "lucide-react";
import { weekdayLabels, seasonLabels, type Post } from "@/lib/types";
import { KakaoMap, type MapPoint } from "./kakao-map";
import { TimePicker } from "./time-picker";

export function LifeReportFields({
  post,
  demo,
  point,
  onPointChange,
  geo,
  onGeoChange,
}: {
  post?: Post;
  demo: boolean;
  point: [number, number];
  onPointChange: (point: [number, number]) => void;
  geo: MapPoint | null;
  onGeoChange: (point: MapPoint) => void;
}) {
  const [scheduleType, setScheduleType] = useState<"WEEKLY" | "ONCE">(
    post?.scheduleType ?? "WEEKLY",
  );
  return (
    <>
      {!demo && (
        <>
          <div className="location-picker mt-2">
            <KakaoMap point={geo} onPick={onGeoChange} />
          </div>
          <small className="mt-1 block">
            {geo
              ? "지도 위치를 선택했어요."
              : "지도를 눌러 위치를 선택해주세요."}
          </small>
        </>
      )}
      {demo && (
        <div
          className="location-picker mt-2"
          tabIndex={0}
          role="button"
          aria-label="지도에서 위치 선택. 방향키로도 이동할 수 있습니다."
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            onPointChange([
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
              onPointChange([
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
              <span>
                {label}
                <Square
                  className="choice-square"
                  size={18}
                  aria-hidden="true"
                />
                <SquareCheck
                  className="choice-square-checked"
                  size={18}
                  aria-hidden="true"
                />
              </span>
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
                <span>
                  {label}
                  <Square
                    className="choice-square"
                    size={18}
                    aria-hidden="true"
                  />
                  <SquareCheck
                    className="choice-square-checked"
                    size={18}
                    aria-hidden="true"
                  />
                </span>
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
                <span>
                  {label}
                  <Square
                    className="choice-square"
                    size={18}
                    aria-hidden="true"
                  />
                  <SquareCheck
                    className="choice-square-checked"
                    size={18}
                    aria-hidden="true"
                  />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <small className="mt-2 block text-muted">
        요일·시간·계절은 아는 정보만 선택해주세요.
      </small>
    </>
  );
}
