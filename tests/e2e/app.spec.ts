import { expect, test } from "@playwright/test";

test("home page loads, charts render, and interactive toggles work without browser errors", async ({
  page,
}) => {
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /A deeper React experience for the complete history of India’s stock market/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /A professional candlestick chart first, with expand-to-window viewing and a structural context mode/i,
    }),
  ).toBeVisible();

  const mainChart = page.getByTestId("main-market-chart");
  const comparisonChart = page.getByTestId("comparison-chart");

  await expect(mainChart).toBeVisible();
  await expect(comparisonChart).toBeVisible();
  await expect(
    page.locator(
      ".vite-error-overlay, [data-nextjs-dialog], #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);

  await expect(
    mainChart.getByRole("button", { name: /^MA 20$/i }),
  ).toBeVisible();
  await expect(
    mainChart.getByRole("button", { name: /Price action only/i }),
  ).toBeVisible();
  await expect(
    mainChart.getByRole("button", { name: /Expand to window/i }),
  ).toBeVisible();
  await mainChart.getByRole("button", { name: /Long Horizon Context/i }).click();
  await expect(mainChart.getByText(/Structural annual context/i)).toBeVisible();
  await mainChart.getByRole("button", { name: /Compare off/i }).click();
  await expect(mainChart.getByText(/Compare ranges/i)).toBeVisible();
  await mainChart.getByRole("button", { name: /Candlestick Desk/i }).click();
  await expect(mainChart.getByText(/Candlestick-first technical view/i)).toBeVisible();

  await comparisonChart.getByRole("button", { name: /Last 10Y/i }).click();
  await expect(comparisonChart.getByText(/Visible span/i)).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
