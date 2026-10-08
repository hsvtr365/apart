import { test, expect } from "@playwright/test";
import { demoData } from "../../src/lib/demo";
test("React screens, report, profile and comments", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ json: demoData() }),
  );
  await page.goto("/");
  await expect(page.getByText("오늘의 소식", { exact: true })).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/feed", "/map", "/report", "/my"]) {
      await page.goto(route);
      await expect(
        page.getByText("데모 · 변경 내용은 새로고침하면 초기화됩니다."),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
  }
  await page.goto("/report");
  await page.locator("#report-title").fill("테스트 소식");
  await page.locator("#report-body").fill("이웃들에게 알리는 소식입니다.");
  await page.getByRole("button", { name: "소식 올리기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "테스트 소식" }),
  ).toBeVisible();
  await page
    .locator("article")
    .first()
    .getByRole("link", { name: "댓글 보기" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("댓글 내용").fill("첫 댓글");
  await page.getByRole("button", { name: "게시", exact: true }).click();
  await expect(page.getByText("첫 댓글", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("첫 댓글", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await page.getByRole("link", { name: "내 정보", exact: true }).click();
  await page.getByRole("button", { name: "프로필 수정" }).click();
  await page.locator("[name=nickname]").fill("새이웃");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("heading", { name: "새이웃" })).toBeVisible();
  expect(errors).toEqual([]);
});
