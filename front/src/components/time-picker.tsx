"use client";
import { useEffect, useId, useRef, useState } from "react";

const times = Array.from(
  { length: 48 },
  (_, index) =>
    `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
);

export function TimePicker({
  arrival,
  departure,
}: {
  arrival: string | null;
  departure: string | null;
}) {
  const [values, setValues] = useState({
    arrivalTime: arrival,
    departureTime: departure,
  });
  const [active, setActive] = useState<"arrivalTime" | "departureTime" | null>(
    null,
  );
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const value = values[active] ?? "06:00";
    const target = list.current?.querySelector<HTMLButtonElement>(
      `[data-time="${value}"]`,
    );
    if (target && list.current) list.current.scrollTop = target.offsetTop;
  }, [active]);
  return (
    <section className="time-picker" aria-label="운영 시간 선택">
      <div className="time-picker-fields">
        {(
          [
            ["arrivalTime", "오는 시간"],
            ["departureTime", "가는 시간"],
          ] as const
        ).map(([name, label]) => (
          <button
            type="button"
            key={name}
            aria-pressed={active === name}
            aria-expanded={active === name}
            aria-controls={listId}
            onClick={() => setActive(current => current === name ? null : name)}
          >
            <small>{label} · 선택</small>
            <strong>{values[name] ?? "선택 안 함"}</strong>
          </button>
        ))}
      </div>
      <input
        type="hidden"
        name="arrivalTime"
        value={values.arrivalTime ?? ""}
      />
      <input
        type="hidden"
        name="departureTime"
        value={values.departureTime ?? ""}
      />
      {active && <div id={listId}>
      <div className="time-picker-heading">
        <b>{active === "arrivalTime" ? "오는 시간" : "가는 시간"} 선택</b>
      </div>
      <div
        className="time-picker-list"
        ref={list}
        role="group"
        aria-label="시간 목록"
      >
        {times.map((time) => (
          <button
            type="button"
            key={time}
            data-time={time}
            aria-pressed={values[active] === time}
            onClick={() =>
              setValues((current) => ({
                ...current,
                [active]: current[active] === time ? null : time,
              }))
            }
          >
            {time}
          </button>
        ))}
      </div>
      <div className="time-picker-footer">
        <small>
          {values.arrivalTime || values.departureTime
            ? [
                values.arrivalTime && `오는 시간 ${values.arrivalTime}`,
                values.departureTime && `가는 시간 ${values.departureTime}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "아는 시간만 선택해주세요."}
        </small>
        <button
          type="button"
          onClick={() => setValues({ arrivalTime: null, departureTime: null })}
        >
          초기화
        </button>
      </div>
      </div>}
    </section>
  );
}
