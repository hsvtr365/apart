UPDATE "User" SET "nickname" = '탈퇴_' || RIGHT(UPPER("id"), 8) WHERE "withdrawnAt" IS NOT NULL;
UPDATE "NicknameChangeLog" AS log SET "after" = account."nickname" FROM "User" AS account WHERE log."userId" = account."id" AND account."withdrawnAt" IS NOT NULL AND log."reason" = 'WITHDRAWAL' AND log."after" IS NOT NULL;
