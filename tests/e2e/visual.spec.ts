// Visual regression: pixel-diff each workspace in both themes against
// committed baseline screenshots. Catches unintended drift in design tokens,
// Plot rendering, or layout when refactoring.
//
// Baselines are platform-specific (Windows/macOS/Linux render text and
// anti-aliasing differently). To keep CI green without per-platform baselines,
// these tests are gated behind RUN_VISUAL=1. Run locally with:
//   RUN_VISUAL=1 npx playwright test tests/e2e/visual.spec.ts
//
// To regenerate baselines on Linux for CI, use the
// `regenerate-visual-baselines` workflow (Actions tab → Run workflow).

import { expect, test } from "@playwright/test";

const VISUAL_ENABLED = process.env.RUN_VISUAL === "1";

const WORKSPACES = ["index", "macro", "race", "sip", "regimes", "projections"];
const THEMES: Array<"light" | "dark"> = ["light", "dark"];

test.describe("visual regression", () => {
  test.skip(!VISUAL_ENABLED, "Set RUN_VISUAL=1 to run visual regression tests");

  for (const theme of THEMES) {
    for (const slug of WORKSPACES) {
      test(`${slug} (${theme})`, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem("atlas-theme", t);
        }, theme);

        await page.goto(`/#/${slug}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.locator(".figure svg").first().waitFor({ state: "visible" });
        await page.waitForTimeout(250);

        await expect(page).toHaveScreenshot(`${slug}-${theme}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  }
});
