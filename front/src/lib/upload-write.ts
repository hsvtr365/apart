import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { HttpError } from "./write-guards";

export async function prepareUpload(file: File) {
  if (!file.size || file.size > 8 * 1024 * 1024) throw new HttpError("8MB 이하의 사진을 선택해주세요.", 413);
  let bytes: Buffer;
  try {
    bytes = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000 })
      .rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch { throw new HttpError("지원하는 사진 파일을 선택해주세요."); }
  const name = randomBytes(16).toString("hex") + ".webp";
  const dir = process.env.UPLOAD_DIR || "./data/uploads";
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, name);
  await writeFile(target, bytes);
  return { name, url: "/api/uploads/" + name, remove: () => unlink(target).catch(() => {}) };
}
