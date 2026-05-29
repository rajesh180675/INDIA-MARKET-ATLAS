import { expect, test } from "@playwright/test";

test.describe("Research Console", () => {
  test("loads with Index Explorer, workspace rail visible, no console errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => consoleErrors.push(e.message));

    await page.goto("/");

    // Default workspace: Index Explorer
    await expect(
      page.getByRole("heading", { level: 1, name: /Index Explorer/i }),
    ).toBeVisible();

    // Workspace rail present
    for (const name of [/Index Explorer/i, /Macro Lab/i, /Regimes & Crashes/i, /Projection Studio/i]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }

    // No build overlays
    await expect(
      page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay"),
    ).toHaveCount(0);

    // Observable Plot renders an SVG figure
    await expect(page.locator(".figure svg").first()).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("denomination toggle updates URL and re-renders figure", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".figure svg").first()).toBeVisible();

    await page.getByRole("button", { name: "Real (CPI)" }).click();
    await expect(page).toHaveURL(/denom=real/);
    await expect(page.locator(".figure svg").first()).toBeVisible();
  });

  test("deep link restores analysis state from the URL", async ({ page }) => {
    await page.goto("/#/index?denom=usd&from=1991&to=2025");
    await expect(
      page.getByRole("heading", { level: 1, name: /Index Explorer/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "USD", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(".figure svg").first()).toBeVisible();
  });

  test("Projection Studio loads scenario presets and captures in URL", async ({ page }) => {
    await page.goto("/#/projections");
    await expect(
      page.getByRole("heading", { level: 1, name: /Projection Studio/i }),
    ).toBeVisible();
    await expect(page.locator(".figure svg").first()).toBeVisible();

    await page.getByRole("button", { name: /Base case/i }).click();
    await expect(page).toHaveURL(/g=101/);
  });

  test("Macro Lab cross-plot mode updates URL", async ({ page }) => {
    await page.goto("/#/macro");
    await expect(
      page.getByRole("heading", { level: 1, name: /Macro Lab/i }),
    ).toBeVisible();

    const crossPlotBtn = page.getByRole("button", { name: "Cross-plot", exact: true });
    await expect(crossPlotBtn).toBeVisible();
    await expect(crossPlotBtn).toHaveAttribute("aria-pressed", "false");
    await crossPlotBtn.click({ force: true });
    await expect(crossPlotBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".figure svg").first()).toBeVisible();
  });

  test("workspace switching via rail updates heading and URL", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Regimes & Crashes/i }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Regimes & Crashes/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#\/regimes/);
  });
});
