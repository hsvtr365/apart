CREATE TABLE "VisitorPresence" (
  "visitorHash" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "state" "PresenceState" NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisitorPresence_pkey" PRIMARY KEY ("visitorHash", "postId"),
  CONSTRAINT "VisitorPresence_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VisitorPresence_postId_observedAt_idx" ON "VisitorPresence"("postId", "observedAt");
