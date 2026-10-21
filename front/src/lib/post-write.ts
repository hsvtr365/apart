import type { Prisma } from "@/generated/prisma/client";
import { postSchema } from "./validation";
import { HttpError } from "./write-guards";

export async function createPost(tx: Prisma.TransactionClient, authorId: string, raw: unknown) {
  const { imageUrl, imageUrls, ...fields } = postSchema.parse(raw);
  const urls = imageUrls ?? (imageUrl ? [imageUrl] : []);
  const owned = await tx.upload.count({ where: {
    userId: authorId, id: { in: urls.map(url => url.split("/").at(-1)!) },
  } });
  if (owned !== urls.length) throw new HttpError("직접 업로드한 사진을 선택해주세요.");
  return tx.post.create({ data: { ...fields, authorId,
    images: { create: urls.map((url, position) => ({ url, position })) },
  } });
}
