CREATE TABLE "AbuseIdentity" ("id" VARCHAR(64) PRIMARY KEY, "expiresAt" TIMESTAMP(3));
ALTER TABLE "User" ADD COLUMN "withdrawnAt" TIMESTAMP(3), ADD COLUMN "abuseIdentityId" TEXT, ADD COLUMN "abuseLinkExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD CONSTRAINT "User_abuseIdentityId_fkey" FOREIGN KEY ("abuseIdentityId") REFERENCES "AbuseIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Like" ADD COLUMN "abuseIdentityId" TEXT;
ALTER TABLE "Like" ADD CONSTRAINT "Like_abuseIdentityId_fkey" FOREIGN KEY ("abuseIdentityId") REFERENCES "AbuseIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Like_abuseIdentityId_postId_key" ON "Like"("abuseIdentityId", "postId");
CREATE INDEX "AbuseIdentity_expiresAt_idx" ON "AbuseIdentity"("expiresAt");
CREATE TABLE "NicknameChangeLog" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "before" VARCHAR(12), "after" VARCHAR(12), "reason" VARCHAR(32) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL);
ALTER TABLE "NicknameChangeLog" ADD CONSTRAINT "NicknameChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "NicknameChangeLog_userId_createdAt_idx" ON "NicknameChangeLog"("userId", "createdAt");
CREATE INDEX "NicknameChangeLog_expiresAt_idx" ON "NicknameChangeLog"("expiresAt");
CREATE TABLE "AccountSecurityEvent" ("id" TEXT PRIMARY KEY, "identityId" TEXT NOT NULL, "userId" TEXT NOT NULL, "reason" VARCHAR(32) NOT NULL, "postId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL);
ALTER TABLE "AccountSecurityEvent" ADD CONSTRAINT "AccountSecurityEvent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "AbuseIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AccountSecurityEvent_identityId_createdAt_idx" ON "AccountSecurityEvent"("identityId", "createdAt");
CREATE INDEX "AccountSecurityEvent_expiresAt_idx" ON "AccountSecurityEvent"("expiresAt");
UPDATE "User" SET "nickname"='탈퇴한 이용자', "withdrawnAt"=CURRENT_TIMESTAMP WHERE "id"='retired-neighbor';

CREATE INDEX "User_abuseIdentityId_idx" ON "User"("abuseIdentityId");
CREATE INDEX "User_abuseLinkExpiresAt_idx" ON "User"("abuseLinkExpiresAt");
