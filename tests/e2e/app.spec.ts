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

  test("Asset Race workspace renders with all 5 tracks", async ({ page }) => {
    await page.goto("/#/race");
    await expect(
      page.getByRole("heading", { level: 1, name: /Asset Race/i }),
    ).toBeVisible();
    await expect(page.locator(".figure svg").first()).toBeVisible();
    // 5 track toggle buttons (exact match — sidebar scope text mentions equity/gold/etc.)
    for (const t of ["Equity", "Gold", "USD cash", "Fixed deposit", "Inflation (CPI)"]) {
      await expect(page.getByRole("button", { name: t, exact: true })).toBeVisible();
    }
  });

  test("SIP Simulator renders heatmap and detail readouts", async ({ page }) => {
    await page.goto("/#/sip");
    await expect(
      page.getByRole("heading", { level: 1, name: /SIP Simulator/i }),
    ).toBeVisible();
    // Path + heatmap each render at least one figure SVG (Plot may add legend SVGs)
    const figureCount = await page.locator(".figure svg").count();
    expect(figureCount).toBeGreaterThanOrEqual(2);
    // Detail readouts populated (use exact match — "SIP advantage" appears in headings/legends too)
    await expect(page.getByText("SIP IRR", { exact: true })).toBeVisible();
    await expect(page.getByText("SIP advantage", { exact: true })).toBeVisible();
  });

  test("Regimes workspace deep-links into Index Explorer", async ({ page }) => {
    await page.goto("/#/regimes");
    await expect(
      page.getByRole("heading", { level: 1, name: /Regimes & Crashes/i }),
    ).toBeVisible();
    // Click the first "Open →" button (the first regime)
    await page.getByRole("button", { name: "Open →" }).first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Index Explorer/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#\/index/);
    await expect(page).toHaveURL(/from=/);
    await expect(page).toHaveURL(/to=/);
  });

  test("Macro Lab matrix mode renders correlation heatmap", async ({ page }) => {
    await page.goto("/#/macro");
    await expect(
      page.getByRole("heading", { level: 1, name: /Macro Lab/i }),
    ).toBeVisible();
    const matrixBtn = page.getByRole("button", { name: "Matrix", exact: true });
    await expect(matrixBtn).toBeVisible();
    await matrixBtn.click({ force: true });
    await expect(matrixBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".figure svg").first()).toBeVisible();
  });

  test("Index Explorer candle style toggles when nominal", async ({ page }) => {
    await page.goto("/#/index?denom=nominal");
    const candleBtn = page.getByRole("button", { name: "Candle", exact: true });
    await expect(candleBtn).toBeVisible();
    await candleBtn.click({ force: true });
    await expect(candleBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/style=candle/);
  });

  test("Command palette opens with Cmd+K and navigates", async ({ page }) => {
    await page.goto("/");
    // Open palette
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: /Command palette/i })).toBeVisible();
    // Type a query and select
    const input = page.getByRole("textbox", { name: /Command palette search/i });
    await input.fill("asset");
    await page.keyboard.press("Enter");
    // Should land on Asset Race
    await expect(
      page.getByRole("heading", { level: 1, name: /Asset Race/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#\/race/);
  });

  test("Switching workspaces clears workspace-specific URL params (scoping)", async ({ page }) => {
    // Start with index workspace + denom param
    await page.goto("/#/index?denom=usd&from=1991&to=2025");
    // Navigate to a different workspace
    await page.getByRole("button", { name: /Regimes & Crashes/i }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: /Regimes & Crashes/i }),
    ).toBeVisible();
    // The denom param should be gone (workspace-specific), but from/to preserved
    await expect(page).not.toHaveURL(/denom=/);
    await expect(page).toHaveURL(/from=1991/);
    await expect(page).toHaveURL(/to=2025/);
  });
});
