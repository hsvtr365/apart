CREATE TABLE "PostImage" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL CHECK ("position" BETWEEN 0 AND 5),
  CONSTRAINT "PostImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PostImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PostImage_postId_position_key" ON "PostImage"("postId", "position");
INSERT INTO "PostImage" ("id", "postId", "url", "position")
SELECT "id" || '_image_0', "id", "imageUrl", 0 FROM "Post" WHERE "imageUrl" IS NOT NULL;
ALTER TABLE "Post" DROP COLUMN "imageUrl";
