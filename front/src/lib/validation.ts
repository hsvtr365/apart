import { z } from "zod";
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "내용을 입력해주세요.")
    .max(max, `최대 ${max}자까지 입력할 수 있어요.`);
export const profileSchema = z.object({
  nickname: text(12),
  building: z.string().trim().max(8).nullable(),
});
export const commentSchema = z.object({ body: text(500) });
export const postSchema = z
  .object({
    title: text(15),
    body: text(500),
    category: z.enum(["FOOD", "NOTICE", "MARKET"]),
    place: text(40),
    mapX: z.number().min(0).max(100).nullable(),
    mapY: z.number().min(0).max(100).nullable(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    imageUrl: z
      .string()
      .regex(/^\/api\/uploads\/[a-f0-9-]+\.webp$/)
      .nullable(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
  })
  .refine(
    (v) => (v.latitude == null) === (v.longitude == null),
    "지도 위치를 다시 선택해주세요.",
  )
  .refine(
    (v) => (v.mapX === null) === (v.mapY === null),
    "지도 위치를 다시 선택해주세요.",
  );
export function ending(
  date: string | null,
  time: string | null,
  now = new Date(),
) {
  const endDate =
    date ||
    (time
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now)
      : null);
  if (!endDate) return { endDate: null, endTime: null, endsAt: null };
  const day = new Date(endDate + "T00:00:00Z");
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== endDate)
    throw new Error("올바른 종료일을 입력해주세요.");
  const endsAt = new Date(endDate + "T" + (time || "23:59") + ":00+09:00");
  if (Number.isNaN(endsAt.getTime()) || endsAt <= now)
    throw new Error("종료 예정일·시간은 현재 이후로 지정해주세요.");
  return { endDate, endTime: time, endsAt };
}
