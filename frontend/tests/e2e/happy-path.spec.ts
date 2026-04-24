import { expect, test } from "@playwright/test";

test("persona to results happy path", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Use this persona/i }).first().click();
  await page.getByRole("button", { name: "Next: Add Content" }).click();
  await page.getByRole("tab", { name: "Text" }).click();
  await page.getByLabel("Content Text").fill("hello");
  await page.getByRole("button", { name: "Save Text Content" }).click();
  await page.getByRole("button", { name: "Analyze Content" }).click();

  await expect(page.getByRole("heading", { name: "Brain Analysis Results" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
});
