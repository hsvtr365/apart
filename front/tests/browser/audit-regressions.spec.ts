import { test, expect } from "@playwright/test";
import { demoData } from "../../src/lib/demo";

test("received comments cancels in-flight activity and stale tabs cannot replace rows", async ({
  page,
}) => {
  const data = { ...demoData(), mode: "live" };
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ json: data }),
  );
  await page.route("**/api/activity?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({
      json: {
        posts: [
          {
            ...data.posts[0],
            title: route.request().url().includes("liked")
              ? "좋아요 목록"
              : "내 글 목록",
          },
        ],
        nextCursor: null,
      },
    });
  });
  await page.goto("/my");
  await page.getByRole("button", { name: /^받은 댓글/ }).click();
  await expect(page.locator(".loading-mask")).toHaveCount(0);
  await page.getByRole("button", { name: "내 글", exact: true }).click();
  await page.getByRole("button", { name: "좋아요", exact: true }).click();
  await expect(page.getByText("좋아요 목록", { exact: true })).toBeVisible();
  await expect(page.getByText("내 글 목록", { exact: true })).toHaveCount(0);
});

test("schedule drafts survive type/category switches; common controls stay usable", async ({
  page,
}) => {
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ json: demoData() }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/report");
  const monday = page.locator('input[name="weekdays"][value="0"]');
  await monday.check();
  await page.getByRole("radio", { name: "1회", exact: true }).check();
  await page.getByRole("radio", { name: "매주", exact: true }).check();
  await expect(monday).toBeChecked();
  await page.getByRole("radio", { name: "공고", exact: true }).check();
  await page.getByRole("radio", { name: "먹거리", exact: true }).check();
  await expect(monday).toBeChecked();
  await page.goto("/my");
  await page.getByRole("button", { name: "계정 설정" }).click();
  await page.getByRole("button", { name: "회원 탈퇴", exact: true }).click();
  const box = await page.getByRole("checkbox").boundingBox();
  expect(box!.width).toBeLessThan(32);
});

test("detail preserves loaded comment pages after a mutation", async ({
  page,
}) => {
  const data = { ...demoData(), mode: "live" };
  const post = data.posts[0];
  let reads = 0;
  let bootstraps = 0;
  const comments = Array.from({ length: 35 }, (_, i) => ({
    id: "c" + i,
    authorId: "neighbor",
    author: "이웃",
    body: "댓글 " + i,
    createdAt: post.createdAt,
  }));
  await page.route("**/api/bootstrap", (route) => {
    bootstraps++;
    return route.fulfill({ json: data });
  });
  await page.route("**/api/posts/**", (route) => {
    if (route.request().method() === "PUT")
      return route.fulfill({ json: { ok: true } });
    reads++;
    const second = route.request().url().includes("cursor=");
    return route.fulfill({
      json: {
        ...post,
        commentCount: 35,
        comments: second ? comments.slice(30) : comments.slice(0, 30),
        nextCursor: second ? null : "c29",
      },
    });
  });
  await page.goto("/post/" + post.id);
  await page.getByRole("button", { name: "댓글 더 불러오기" }).click();
  await expect(page.getByText("댓글 34", { exact: true })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "좋아요", exact: true })
    .click();
  await expect(page.getByText("댓글 34", { exact: true })).toBeVisible();
  await expect.poll(() => reads).toBeGreaterThanOrEqual(5);
  await expect(page.locator(".comment-author-name")).toHaveCount(35);
  expect(bootstraps).toBe(1);
});
