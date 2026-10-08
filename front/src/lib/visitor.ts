import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { cookieOptions, hash } from "./auth";

export async function visitorHash(create = false) {
  const jar = await cookies();
  let token = jar.get("village_visitor")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) return undefined;
    token = randomBytes(32).toString("hex");
    jar.set("village_visitor", token, { ...cookieOptions(), maxAge: 365 * 86400 });
  }
  return hash(token);
}
