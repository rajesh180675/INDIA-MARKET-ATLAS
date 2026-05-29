// WCAG accessibility scan via axe-core. One scan per workspace + the command
// palette. Configured to fail the build on serious/critical violations only;
// minor issues are logged for review but don't gate CI.

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const WORKSPACES = ["index", "macro", "race", "sip", "regimes", "projections"];
const REPORT_DIR = path.resolve("test-results/a11y-reports");

for (const slug of WORKSPACES) {
  test(`a11y: ${slug} workspace has no critical/serious violations`, async ({
    page,
  }) => {
    await page.goto(`/#/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .exclude("svg g")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (blocking.length > 0) {
      // Persist full per-node details for offline triage — Playwright's
      // reporter truncates long error messages.
      fs.mkdirSync(REPORT_DIR, { recursive: true });
      const reportPath = path.join(REPORT_DIR, `${slug}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(blocking, null, 2));

      const summary = blocking
        .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
        .join("; ");
      throw new Error(
        `Accessibility violations on /${slug} — see ${reportPath}\n${summary}`,
      );
    }
  });
}

test("a11y: command palette has no critical/serious violations when open", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog", { name: /Command palette/i })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  if (blocking.length > 0) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = path.join(REPORT_DIR, `command-palette.json`);
    fs.writeFileSync(reportPath, JSON.stringify(blocking, null, 2));
  }

  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("; ")).toEqual([]);
});

