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
export const postSchema = z
  .object({
    title: text(15),
    body: text(500),
    category: z.enum(["FOOD", "NOTICE", "MARKET"]),
    mapX: z.number().min(0).max(100).nullable(),
    mapY: z.number().min(0).max(100).nullable(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    imageUrl: z
      .string()
      .regex(/^\/api\/uploads\/[a-f0-9-]+\.webp$/)
      .nullable(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]).transform(v => [...new Set(v)].sort()),
    seasons: z.array(z.enum(["SPRING", "SUMMER", "AUTUMN", "WINTER"])).max(4).default([]).transform(v => [...new Set(v)]),
    arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  })
  .refine(
    (v) => (v.latitude == null) === (v.longitude == null),
    "지도 위치를 다시 선택해주세요.",
  )
  .refine(
    (v) => (v.mapX === null) === (v.mapY === null),
    "지도 위치를 다시 선택해주세요.",
  );
