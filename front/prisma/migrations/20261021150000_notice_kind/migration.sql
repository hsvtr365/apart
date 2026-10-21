ALTER TABLE "Post" ADD COLUMN "noticeKind" VARCHAR(7);
ALTER TABLE "Post" ADD CONSTRAINT "Post_noticeKind_check" CHECK ("noticeKind" IS NULL OR "noticeKind" IN ('SHORT', 'ROUTINE'));
UPDATE "Post" SET "noticeKind" = CASE
  WHEN ("noticeStartDate"::date + INTERVAL '1 month')::date <= "noticeEndDate"::date
    OR regexp_replace(title, '[[:space:].!?]', '', 'g') IN ('주차단속안내', '주차단속', '공사협조안내', '공사협조', '화분밖으로던지지마세요')
  THEN 'ROUTINE' ELSE 'SHORT' END WHERE category = 'NOTICE';
