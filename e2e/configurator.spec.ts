import { expect, test } from "@playwright/test";
import axe from "axe-core";

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|ws\.geonorge\.no/, (route) => route.abort());
  await page.goto("./");
  await page.getByLabel("Language").selectOption("en");
});

test("guides role, GPS, location and generated naming into export", async ({ page }) => {
  await page.getByLabel("Device role").selectOption({ label: "CLIENT_MUTE" });
  await page.getByLabel("GPS enabled").check();
  await page.getByLabel("Latitude").fill("59.91");
  await page.getByLabel("Longitude").fill("10.75");
  await page.getByLabel("Municipality").selectOption("OSL");
  await page.getByLabel("Location", { exact: true }).fill("SENTRUM");
  await page.getByLabel("Owner", { exact: true }).fill("WF");
  await page.getByLabel(/Short name/).fill("📡");
  await expect(page.getByLabel(/Long name/)).toHaveValue("M-OSL-SENTRUM-WF");
  await page.getByRole("button", { name: "Export .cfg" }).click();
  await expect(page.getByRole("heading", { name: "Review export" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download profile" })).toBeEnabled();
});

test("previews the Norway bundle without replacing the primary channel", async ({ page }) => {
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("Append after the primary channel")).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Primary", { exact: true })).toBeVisible();
  await expect(page.locator('input[value="Nord-Norge"]')).toBeVisible();
});

test("resolves location automatically and protects a manual place name", async ({ page }) => {
  await page.unroute(/ws\.geonorge\.no/);
  await page.route(/kommuneinfo/, (route) => route.fulfill({ json: { kommunenummer: "0301", kommunenavn: "Oslo", fylkesnavn: "Oslo" } }));
  await page.route(/stedsnavn/, (route) => route.fulfill({ json: { navn: [{ skrivemåte: "SENTRUM" }] } }));
  await page.route(/hoydedata/, (route) => route.fulfill({ json: { punkter: [{ z: 42 }] } }));
  await page.getByLabel("Latitude").fill("59.91");
  await page.getByLabel("Longitude").fill("10.75");
  await expect(page.getByLabel("Municipality")).toHaveValue("OSL");
  await expect(page.getByLabel("Location", { exact: true })).toHaveValue("SENTRUM");
  await expect(page.getByLabel("Elevation")).toHaveValue("42");
  await page.getByLabel("Location", { exact: true }).fill("MANUAL");
  await page.getByLabel("Latitude").fill("59.92");
  await expect(page.getByLabel("Location", { exact: true })).toHaveValue("MANUAL");
});

test("has no serious automated accessibility violations", async ({ page }) => {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => { const result = await (window as typeof window & { axe: typeof axe }).axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }); return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical"); });
  expect(violations).toEqual([]);
});

test("keeps all primary actions visible on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  for (const name of ["Import", "New profile", "Clear local data", "Export .cfg"]) await expect(page.getByRole("button", { name, exact: true })).toBeInViewport();
});
