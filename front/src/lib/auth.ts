import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function origin() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is not configured");
  return new URL(value).origin;
}
export const cookieOptions = () => ({
  httpOnly: true,
  secure: origin().startsWith("https:"),
  sameSite: "lax" as const,
  path: "/",
});
export async function currentUser() {
  const token = (await cookies()).get("village_session")?.value;
  if (!token) return null;
  const session = await db().session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  return session && session.expiresAt > new Date() ? session.user : null;
}
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 86400_000);
  await db().session.create({
    data: { tokenHash: hash(token), userId, expiresAt },
  });
  (await cookies()).set("village_session", token, {
    ...cookieOptions(),
    expires: expiresAt,
  });
}
