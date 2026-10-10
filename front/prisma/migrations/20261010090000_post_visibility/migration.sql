ALTER TABLE "User" ADD COLUMN "permission" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD CONSTRAINT "User_permission_check" CHECK ("permission" IN (0, 1));
ALTER TABLE "Post" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "permission" = 0, "role" = 'ADMIN' WHERE "id" = 'cmuz2e3x80000yoitldfj8ows';
