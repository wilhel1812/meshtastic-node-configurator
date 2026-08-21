import { expect, test } from "@playwright/test";
import axe from "axe-core";

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|ws\.geonorge\.no/, (route) => route.abort());
  await page.goto("./");
  await page.getByLabel("Language").selectOption("en");
});

test("guides role, GPS, location and generated naming into export", async ({ page }) => {
  await page.getByLabel("Device role").selectOption("1");
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
  await page.route(/stedsnavn/, (route) => route.fulfill({ json: { navn: [{ stedsnavn: [{ navnestatus: "hovednavn", skrivemåte: "SENTRUM" }] }] } }));
  await page.route(/hoydedata/, (route) => route.fulfill({ json: { punkter: [{ z: 42 }] } }));
  const placeRequest = page.waitForRequest(/stedsnavn\/v1\/punkt\?nord=59\.91&ost=10\.75&koordsys=4258/);
  const elevationRequest = page.waitForRequest(/hoydedata\/v1\/punkt\?nord=59\.91&ost=10\.75&koordsys=4258/);
  await page.getByLabel("Latitude").fill("59.91");
  await page.getByLabel("Longitude").fill("10.75");
  await Promise.all([placeRequest, elevationRequest]);
  await expect(page.getByLabel("Municipality")).toHaveValue("OSL");
  await expect(page.getByLabel("Location", { exact: true })).toHaveValue("SENTRUM");
  await expect(page.getByLabel("Elevation")).toHaveValue("42");
  await page.getByLabel("Location", { exact: true }).fill("MANUAL");
  await page.getByLabel("Latitude").fill("59.92");
  await expect(page.getByLabel("Location", { exact: true })).toHaveValue("MANUAL");
});

test("shows the Router warning without moving to another section", async ({ page }) => {
  await page.evaluate(() => { (window as any).__forcedScroll = false; HTMLElement.prototype.scrollIntoView = () => { (window as any).__forcedScroll = true; }; });
  await page.getByLabel("Device role").selectOption("2");
  await expect(page.getByText(/Router is an infrastructure role/)).toBeVisible();
  expect(await page.evaluate(() => (window as any).__forcedScroll)).toBe(false);
  await page.locator("#position-card").getByText("Details").click();
  await expect(page.getByLabel("Position Broadcast Secs")).toHaveValue("14400");
  await expect(page.getByLabel("Position Broadcast Smart Enabled")).toHaveValue("false");
});

test("puts common roles first and guides the Client fallback", async ({ page }) => {
  const role = page.getByLabel("Device role");
  await expect(role.locator("optgroup").nth(0)).toHaveAttribute("label", "For most users");
  await expect(role.locator("optgroup").nth(1)).toHaveAttribute("label", "Advanced");
  await expect(role.locator("optgroup").nth(0).locator("option")).toHaveText([
    "Client Mute — personal or moving node",
    "Client Base — fixed rooftop or base node",
    "Client — general-purpose client",
  ]);
  await expect(role.locator("optgroup").nth(1).locator("option")).toHaveText([
    "Router",
    "Router Client",
    "Repeater",
    "Tracker",
    "Sensor",
    "TAK",
    "Client Hidden",
    "Lost and Found",
    "TAK Tracker",
    "Router Late",
  ]);
  await role.selectOption("0");
  await expect(page.getByText("Client works, but prefer Client Mute for a personal or moving node, or Client Base for a fixed rooftop node.")).toBeVisible();
  await role.selectOption("1");
  await expect(page.getByText("Recommended for personal nodes and nodes that move.")).toBeVisible();
});

test("uses plain-language internet choices", async ({ page }) => {
  await page.getByLabel("Yes, I consent").check();
  const connection = page.getByLabel("How should the node connect to the internet?");
  await expect(connection).toBeVisible();
  await expect(connection.locator("option")).toHaveText(["Via your phone", "Wi-Fi"]);
});

test("reveals channel keys on request", async ({ page }) => {
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  const key = page.getByLabel("Key", { exact: true }).first();
  await expect(key).toHaveAttribute("type", "password");
  await page.getByLabel("Show channel keys").check();
  await expect(key).toHaveAttribute("type", "text");
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
