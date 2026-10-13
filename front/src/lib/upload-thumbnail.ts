import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const pending = new Map<string, Promise<Buffer>>();
export async function uploadBytes(dir: string, id: string, thumbnail: boolean) {
  const original = path.join(/* turbopackIgnore: true */ dir, id);
  if (!thumbnail) return readFile(/* turbopackIgnore: true */ original);
  const cache = path.join(/* turbopackIgnore: true */ dir, "thumbnails", id);
  try {
    return await readFile(/* turbopackIgnore: true */ cache);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const existing = pending.get(cache);
  if (existing) return existing;
  const work = (async () => {
    const source = await readFile(/* turbopackIgnore: true */ original);
    const bytes = await sharp(source)
      .resize(336, 540, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    await mkdir(path.dirname(cache), { recursive: true });
    const temp = cache + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temp, bytes);
      await rename(temp, cache);
    } finally {
      await unlink(temp).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    return bytes;
  })();
  pending.set(cache, work);
  try {
    return await work;
  } finally {
    pending.delete(cache);
  }
}
