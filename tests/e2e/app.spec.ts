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
    for (const name of [/Index Explorer/i, /Macro Lab/i, /State Economy Lab/i, /Regimes & Crashes/i, /Projection Studio/i]) {
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
    // Wait for at least one Plot figure to mount (ResizeObserver is async on fast runners)
    await page.locator(".figure svg").first().waitFor({ state: "visible" });
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

  test("Projection Studio Monte Carlo mode renders fan chart and bands", async ({
    page,
  }) => {
    await page.goto("/#/projections?m=mc");
    await expect(
      page.getByRole("heading", { level: 1, name: /Projection Studio/i }),
    ).toBeVisible();

    // The headline readouts switch to MC-specific labels
    await expect(page.getByText("Median 2050", { exact: true })).toBeVisible();
    await expect(page.getByText("P5–P95 2050", { exact: true })).toBeVisible();

    // The fan chart figure mounts
    await page.locator(".figure svg").first().waitFor({ state: "visible" });
    await expect(
      page.getByRole("figure", {
        name: /Monte Carlo|Distribution of paths/i,
      }),
    ).toBeVisible();

    // CAGR slider should be disabled in MC mode
    const cagrSlider = page.getByLabel("Equity CAGR assumption");
    await expect(cagrSlider).toBeDisabled();
  });

  test("Dataset chip is visible and version mismatch banner appears for stale pins", async ({
    page,
  }) => {
    await page.goto("/");
    // Chip is always visible (in the rail at lg+, in mobile drawer otherwise — text matches both)
    await expect(page.getByText(/data · \d{4}-\d{2}/)).toBeVisible();
    // No banner when no pin
    await expect(page.getByText(/Dataset version mismatch/i)).not.toBeVisible();

    // Pin to a deliberately old version → banner appears
    await page.goto("/#/index?dataset=2020-01");
    const banner = page.getByRole("status").filter({ hasText: /Dataset version mismatch/i });
    await expect(banner).toBeVisible();
    await expect(banner.getByText("2020-01", { exact: true })).toBeVisible();

    // Dismiss persists in localStorage
    await banner.getByRole("button", { name: /Dismiss dataset/i }).click();
    await expect(banner).not.toBeVisible();
  });

  test("Formula Lab evaluates formulas and renders type-driven results", async ({
    page,
  }) => {
    // Direct URL with a formula in ?f= — exercises the URL-shareable contract
    await page.goto("/#/formula?f=cagr(sensex,1979,2025)");
    await expect(
      page.getByRole("heading", { level: 1, name: /Formula Lab/i }),
    ).toBeVisible();

    // Scalar result panel (label "Result · scalar")
    await expect(page.getByText(/Result · scalar/i)).toBeVisible();

    // Switch to a formula that returns a Series → expect a chart to mount
    await page.goto("/#/formula?f=yoy(sensex)");
    await page.locator(".figure svg[role='img']").first().waitFor({ state: "visible" });

    // Bad formula → red error panel
    await page.goto("/#/formula?f=nope(x");
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert.getByText(/Parse error/i).first()).toBeVisible();

    // Click an example seeds the editor and runs
    await page.goto("/#/formula");
    await page
      .getByRole("button", { name: /Sensex monthly Sharpe/i })
      .click();
    await expect(page.getByText(/Result · scalar/i)).toBeVisible();
  });

  test("Saved scenarios drawer opens, persists, and reloads view", async ({
    page,
  }) => {
    // Start fresh — clear localStorage so test is hermetic
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("atlas-saved-scenarios"));

    // Set up a recognizable URL state to save
    await page.goto("/#/index?denom=usd&from=1991&to=2025");

    // Open the drawer via the rail button
    await page.getByRole("button", { name: /Open saved scenarios/i }).click();
    const drawer = page.getByRole("dialog", { name: /Saved scenarios/i });
    await expect(drawer).toBeVisible();

    // Save current view with a unique name
    await drawer.getByLabel("Scenario name").fill("USD reform era");
    await drawer.getByLabel("Scenario note").fill("Index in USD, 1991-2025");
    await drawer.getByRole("button", { name: "Save view" }).click();

    // It appears in the list
    await expect(drawer.getByText("USD reform era")).toBeVisible();
    await expect(drawer.getByText("Index in USD, 1991-2025")).toBeVisible();

    // Close drawer, navigate elsewhere
    await drawer.getByRole("button", { name: /Close scenarios panel/i }).click();
    await page.goto("/#/macro");

    // Reopen, click the saved name → should navigate back to index?denom=usd
    await page.getByRole("button", { name: /Open saved scenarios/i }).click();
    await drawer.getByText("USD reform era").click();
    await expect(page).toHaveURL(/#\/index\?.*denom=usd/);
    await expect(page).toHaveURL(/from=1991/);
  });

  test("Sector Lab renders rebased view, RS view, and period returns table", async ({
    page,
  }) => {
    await page.goto("/#/sectors");
    await expect(
      page.getByRole("heading", { level: 1, name: /Sector Lab/i }),
    ).toBeVisible();

    // Headline readouts present
    await expect(page.getByText("Best sector", { exact: true })).toBeVisible();
    await expect(page.getByText("Worst sector", { exact: true })).toBeVisible();

    // Rebased chart mounts by default
    await page.locator(".figure svg").first().waitFor({ state: "visible" });

    // Switch to RS view via URL
    await page.goto("/#/sectors?sv=rs");
    await expect(
      page.getByRole("figure", {
        name: /Relative strength/i,
      }),
    ).toBeVisible();

    // Switch to table view — no figure SVG, but a real <table>
    await page.goto("/#/sectors?sv=table");
    await expect(page.getByRole("table")).toBeVisible();
    // Composite row should be bold (rendered via <strong>)
    await expect(page.getByRole("table").getByText("Nifty 50")).toBeVisible();
  });

  test("Volatility & Risk workspace renders monthly metrics", async ({ page }) => {
    await page.goto("/#/vol");
    await expect(
      page.getByRole("heading", { level: 1, name: /Volatility & Risk/i }),
    ).toBeVisible();

    // The four headline readouts should be present (use exact match —
    // axis labels and provenance text mention these phrases too)
    await expect(page.getByText("Sharpe (rf=6%)", { exact: true })).toBeVisible();
    await expect(page.getByText("Annualized vol", { exact: true })).toBeVisible();
    await expect(page.getByText("Max drawdown", { exact: true })).toBeVisible();

    // The drawdown chart figure
    await expect(
      page.getByRole("figure", {
        name: /drawdown from running peak/i,
      }),
    ).toBeVisible();
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
