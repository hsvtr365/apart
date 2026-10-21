CREATE TABLE "BotPublication" (
    "requestKey" VARCHAR(64) NOT NULL,
    "postId" TEXT NOT NULL,
    "photoHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotPublication_pkey" PRIMARY KEY ("requestKey")
);
CREATE UNIQUE INDEX "BotPublication_postId_key" ON "BotPublication"("postId");
CREATE INDEX "BotPublication_photoHash_idx" ON "BotPublication"("photoHash");
