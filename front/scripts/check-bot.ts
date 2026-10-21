// Runs only against a disposable database; never writes to the configured app DB.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import sharp from "sharp";
import { POST } from "../src/app/api/internal/bot/route";
import { db } from "../src/lib/db";

const original = process.env.DATABASE_URL;
assert(original, "DATABASE_URL required");
const name = "village_bot_test_" + randomBytes(6).toString("hex");
const admin = new pg.Client({ connectionString: original, connectionTimeoutMillis: 5000 });
const url = new URL(original); url.pathname = "/" + name;
const uploadDir = await mkdtemp(path.join(tmpdir(), "village-bot-"));
const secret = randomBytes(32).toString("hex");
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  process.env.DATABASE_URL = url.toString();
  process.env.UPLOAD_DIR = uploadDir;
  process.env.APP_BOT_SECRET = secret;
  const child = spawn(process.execPath, ["scripts/migrate.cjs"], { env: process.env, stdio: "ignore", windowsHide: true });
  assert.equal((await once(child, "exit"))[0], 0, "Disposable migration failed");
  const author = await db().user.create({ data: { nickname: "마을봇" } });
  process.env.BOT_AUTHOR_ID = author.id;
  const headers = { Authorization: "Bearer " + secret };
  const search = (value: unknown, auth = true) => POST(new Request("http://localhost/api/internal/bot", {
    method: "POST", headers: { "Content-Type": "application/json", ...(auth ? headers : {}) }, body: JSON.stringify(value),
  }));
  assert.equal((await search({}, false)).status, 401);
  assert.equal((await search({ date: "2026-02-30" })).status, 400);
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
  const key = randomBytes(32).toString("hex");
  const draft = { title: "테스트공고", body: "사진 등록 검증", category: "NOTICE", noticeStartDate: "2026-10-01", noticeEndDate: "2026-10-31" };
  const publish = () => {
    const form = new FormData();
    form.append("requestKey", key); form.append("post", JSON.stringify(draft));
    form.append("files", new Blob([image], { type: "image/png" }), "test.png");
    return POST(new Request("http://localhost/api/internal/bot", { method: "POST", headers, body: form }));
  };
  const results = await Promise.all([publish(), publish()]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 201]);
  const [a, b] = await Promise.all(results.map(r => r.json()));
  assert.equal(a.id, b.id);
  assert.equal(await db().post.count(), 1);
  assert.equal(await db().upload.count(), 1);
  assert.equal(await db().botPublication.count(), 1);
  const row = await db().post.findUniqueOrThrow({ where: { id: a.id }, include: { images: true } });
  assert.equal(row.images.length, 1);
  assert.match(row.images[0].url, /\.webp$/);
  assert.equal((await (await search({ query: "テスト" })).json()).posts.length, 0);
  assert.equal((await (await search({ category: "NOTICE", date: "2026-10-21" })).json()).posts.length, 1);
  for (const field of ["hidden", "adminDeleted", "userDeleted"] as const) {
    await db().post.update({ where: { id: a.id }, data: { [field]: true } });
    assert.equal((await (await search({})).json()).posts.length, 0);
    await db().post.update({ where: { id: a.id }, data: { [field]: false } });
  }
  console.log("PASS bot API: authentication, calendar validation, image conversion, atomic duplicate publication, hidden/deleted filtering");
} finally {
  await db().$disconnect();
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
  // mkdtemp supplies a dedicated absolute directory in the OS temp directory.
  assert(path.resolve(uploadDir).startsWith(path.resolve(tmpdir()) + path.sep));
  await rm(uploadDir, { recursive: true, force: true });
}
