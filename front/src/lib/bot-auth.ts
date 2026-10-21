import { timingSafeEqual } from "node:crypto";

export function botAuthorized(value: string | null, secret = process.env.APP_BOT_SECRET) {
  if (!secret || secret.length < 32 || !value) return false;
  const expected = Buffer.from("Bearer " + secret);
  const actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
