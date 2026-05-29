// Visual regression: pixel-diff each workspace in both themes against
// committed baseline screenshots. Catches unintended drift in design tokens,
// Plot rendering, or layout when refactoring.
//
// First run: `npx playwright test tests/e2e/visual.spec.ts --update-snapshots`
// Subsequent runs compare. Tolerance is loose (0.2 ratio) since Plot's
// auto-tick choices can shift by a pixel between runs.

import { expect, test } from "@playwright/test";

const WORKSPACES = ["index", "macro", "race", "sip", "regimes", "projections"];
const THEMES: Array<"light" | "dark"> = ["light", "dark"];

for (const theme of THEMES) {
  for (const slug of WORKSPACES) {
    test(`visual: ${slug} (${theme})`, async ({ page }) => {
      // Set theme via localStorage before page load, otherwise the toggle
      // animation runs and dirties the diff.
      await page.addInitScript((t) => {
        localStorage.setItem("atlas-theme", t);
      }, theme);

      await page.goto(`/#/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // Wait for at least one figure SVG to mount before capturing
      await page.locator(".figure svg").first().waitFor({ state: "visible" });

      // Brief settle pause so ResizeObserver-driven re-renders complete
      await page.waitForTimeout(250);

      // Full-page screenshot. maxDiffPixelRatio gives Plot some leeway on
      // its automatic tick choices.
      await expect(page).toHaveScreenshot(`${slug}-${theme}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
}
