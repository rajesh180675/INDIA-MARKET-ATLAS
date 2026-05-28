import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import App from "./App";

describe("App", () => {
  test("renders main sections and candlestick desk", async () => {
    render(<App />);

    // Main market chart (lazy-loaded)
    const mainChart = await screen.findByTestId("main-market-chart", {}, { timeout: 10000 });
    expect(mainChart).toBeInTheDocument();

    // Comparison chart
    const comparisonChart = await screen.findByTestId("comparison-chart", {}, { timeout: 10000 });
    expect(comparisonChart).toBeInTheDocument();

    // Candlestick desk section
    const candlestickChart = await screen.findByTestId("candlestick-chart", {}, { timeout: 10000 });
    expect(candlestickChart).toBeInTheDocument();

    // Candlestick context buttons (scoped to parent of candlestick chart)
    const candlestickSection = candlestickChart.closest("section")!;
    expect(within(candlestickSection).getByRole("button", { name: /Price only/i })).toBeInTheDocument();
    expect(within(candlestickSection).getByRole("button", { name: /\+ GDP Growth/i })).toBeInTheDocument();
  }, 20000);
});
