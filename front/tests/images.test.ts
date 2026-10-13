import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { thumbnailUrl } from "../src/lib/images";
import { uploadBytes } from "../src/lib/upload-thumbnail";

test("home/feed thumbnails share URLs and atomic concurrent cache generation", async () => {
  assert.equal(
    thumbnailUrl("/api/uploads/abc.webp?size=feed"),
    "/api/uploads/abc.webp?size=feed",
  );
  assert.equal(thumbnailUrl("/food.svg"), "/food.svg");
  assert.equal(thumbnailUrl(null), null);
  const dir = await mkdtemp(path.join(tmpdir(), "apart-thumb-"));
  try {
    const source = await sharp({
      create: { width: 1000, height: 800, channels: 3, background: "green" },
    })
      .webp()
      .toBuffer();
    await writeFile(path.join(dir, "abc.webp"), source);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => uploadBytes(dir, "abc.webp", true)),
    );
    const cache = await readFile(path.join(dir, "thumbnails", "abc.webp"));
    assert(results.every((bytes) => bytes.equals(cache)));
    assert.deepEqual(await readdir(path.join(dir, "thumbnails")), ["abc.webp"]);
    assert.equal((await sharp(cache).metadata()).width, 336);
    assert((await uploadBytes(dir, "abc.webp", false)).equals(source));
    assert((await uploadBytes(dir, "abc.webp", true)).equals(cache));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
