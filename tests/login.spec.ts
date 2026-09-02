import { test, expect } from "@playwright/test";

test("로그인이 잘 되는지 확인", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.fill('input[type="email"]', "test01@company.com");
  await page.fill('input[type="password"]', "test1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 60000 });
  await expect(page.getByText("무엇을 찾고 계신가요?")).toBeVisible();
});
