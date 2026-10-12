ALTER TABLE "Presence" ADD COLUMN "occurrence" VARCHAR(32);
ALTER TABLE "VisitorPresence" ADD COLUMN "occurrence" VARCHAR(32);
CREATE TABLE "PresenceEvent" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "visitorHash" TEXT NOT NULL,
    "occurrence" VARCHAR(32) NOT NULL,
    "state" "PresenceState" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PresenceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PresenceEvent_postId_occurrence_observedAt_id_idx" ON "PresenceEvent"("postId", "occurrence", "observedAt", "id");
CREATE INDEX "PresenceEvent_postId_observedAt_id_idx" ON "PresenceEvent"("postId", "observedAt", "id");
CREATE INDEX "PresenceEvent_visitorHash_observedAt_idx" ON "PresenceEvent"("visitorHash", "observedAt");
CREATE INDEX "PresenceEvent_userId_observedAt_idx" ON "PresenceEvent"("userId", "observedAt");
ALTER TABLE "PresenceEvent" ADD CONSTRAINT "PresenceEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresenceEvent" ADD CONSTRAINT "PresenceEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
