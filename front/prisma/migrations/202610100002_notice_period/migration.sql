ALTER TABLE "Post" ADD COLUMN "noticeStartDate" VARCHAR(10), ADD COLUMN "noticeEndDate" VARCHAR(10);

-- Preserve only explicitly entered dates. Undated notices require an author edit.
UPDATE "Post"
SET "noticeStartDate" = "startDate", "noticeEndDate" = COALESCE("finishDate", "startDate"),
    "startDate" = NULL, "finishDate" = NULL, "weekdays" = '{}', "seasons" = '{}',
    "arrivalTime" = NULL, "departureTime" = NULL,
    "mapX" = NULL, "mapY" = NULL, "latitude" = NULL, "longitude" = NULL
WHERE "category" = 'NOTICE';
