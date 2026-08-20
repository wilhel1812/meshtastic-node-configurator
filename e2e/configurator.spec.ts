import { expect, test } from "@playwright/test";
import axe from "axe-core";

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
  await page.goto("./");
  await page.getByLabel("Language").selectOption("en");
});

test("builds a byte-valid identity and opens export review", async ({ page }) => {
  const identity = page.locator(".identity-card");
  await identity.getByLabel("Municipality").selectOption("OSL");
  await identity.getByLabel("Location", { exact: true }).fill("SENTRUM");
  await identity.getByLabel("Owner", { exact: true }).fill("WF");
  await identity.getByLabel(/Short name/).fill("📡");
  await expect(identity.getByLabel(/Long name/)).toHaveValue("M-OSL-SENTRUM-WF");
  await page.getByRole("button", { name: "Export .cfg" }).click();
  await expect(page.getByRole("heading", { name: "Review export" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download profile" })).toBeEnabled();
});

test("has no serious automated accessibility violations", async ({ page }) => {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await (window as typeof window & { axe: typeof axe }).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    });
    return result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  });
  expect(violations).toEqual([]);
});

test("keeps all primary actions visible on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  for (const name of ["Import", "New profile", "Clear local data", "Export .cfg"]) {
    await expect(page.getByRole("button", { name })).toBeInViewport();
  }
});
