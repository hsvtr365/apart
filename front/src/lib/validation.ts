import { z } from "zod";
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "내용을 입력해주세요.")
    .max(max, `최대 ${max}자까지 입력할 수 있어요.`);
export const profileSchema = z.object({
  nickname: text(12),
  building: z.string().regex(/^20(0[1-9]|1[0-7])동$/, "2001동부터 2017동까지 선택해주세요.").nullable(),
});
export const commentSchema = z.object({ body: text(500) });
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "올바른 날짜를 선택해주세요.").nullable().default(null);
export const postSchema = z
  .object({
    title: text(15),
    hidden: z.boolean().default(false),
    body: text(500),
    category: z.enum(["FOOD", "NOTICE", "MARKET"]),
    scheduleType: z.enum(["WEEKLY", "ONCE"]).default("WEEKLY"),
    startDate: calendarDate,
    finishDate: calendarDate,
    noticeStartDate: calendarDate,
    noticeEndDate: calendarDate,
    mapX: z.number().min(0).max(100).nullable(),
    mapY: z.number().min(0).max(100).nullable(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    imageUrl: z
      .string()
      .regex(/^\/api\/uploads\/[a-f0-9-]+\.webp$/)
      .nullable().default(null),
    imageUrls: z.array(z.string().regex(/^\/api\/uploads\/[a-f0-9-]+\.webp$/)).max(6, "사진은 최대 6장까지 첨부할 수 있어요.").refine(v => new Set(v).size === v.length, "같은 사진은 한 번만 첨부해주세요.").optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]).transform(v => [...new Set(v)].sort()),
    seasons: z.array(z.enum(["SPRING", "SUMMER", "AUTUMN", "WINTER"])).max(4).default([]).transform(v => [...new Set(v)]),
    arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  })
  .refine(v => v.category !== "NOTICE" || !!v.noticeStartDate && !!v.noticeEndDate, "공고 시작일과 종료일을 선택해주세요.")
  .refine(v => v.category !== "NOTICE" || !v.noticeStartDate || !v.noticeEndDate || v.noticeEndDate >= v.noticeStartDate, "공고 종료일은 시작일 이후로 선택해주세요.")
  .refine(v => v.category === "NOTICE" || v.scheduleType !== "ONCE" || !!v.startDate, "1회 일정의 열리는 날을 선택해주세요.")
  .refine(v => v.category === "NOTICE" || v.scheduleType !== "ONCE" || !v.finishDate || !v.startDate || v.finishDate >= v.startDate, "가는 날은 열리는 날 이후로 선택해주세요.")
  .transform(v => v.category === "NOTICE"
    ? {...v, scheduleType: "WEEKLY" as const, startDate: null, finishDate: null, weekdays: [], seasons: [], arrivalTime: null, departureTime: null, mapX: null, mapY: null, latitude: null, longitude: null}
    : {...v, noticeStartDate: null, noticeEndDate: null, ...(v.scheduleType === "WEEKLY" ? {startDate: null, finishDate: null} : {weekdays: [], seasons: []})})
  .refine(
    (v) => (v.latitude == null) === (v.longitude == null),
    "지도 위치를 다시 선택해주세요.",
  )
  .refine(
    (v) => (v.mapX === null) === (v.mapY === null),
    "지도 위치를 다시 선택해주세요.",
  );
