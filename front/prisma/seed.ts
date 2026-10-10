import "dotenv/config";
import { db } from "../src/lib/db";
import { demoData } from "../src/lib/demo";
// Explicitly requested sample seed only. Running migrations never inserts demo accounts or posts.
async function main() {
  const data = demoData();
  for (const id of ["demo", "neighbor"])
    await db().user.upsert({
      where: { id: "sample-" + id },
      create: {
        id: "sample-" + id,
        nickname: id === "demo" ? "행복한 이웃" : "동네 이웃",
      },
      update: {},
    });
  for (const p of data.posts) {
    await db().post.upsert({
      where: { id: "sample-" + p.id },
      create: {
        id: "sample-" + p.id,
        authorId: "sample-" + p.authorId,
        title: p.title,
        body: p.body,
        category: p.category,
        mapX: p.mapX,
        mapY: p.mapY,
        images: { create: p.imageUrl ? [{ url: p.imageUrl, position: 0 }] : [] },
      },
      update: {},
    });
    for (const c of p.comments)
      await db().comment.upsert({
        where: { id: "sample-" + c.id },
        create: {
          id: "sample-" + c.id,
          postId: "sample-" + p.id,
          authorId: "sample-" + c.authorId,
          body: c.body,
        },
        update: {},
      });
  }
  console.log("Sample posts seeded (idempotent).");
}
main().finally(() => db().$disconnect());
