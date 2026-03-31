import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import App from "./App";

describe("App", () => {
  test("renders the candlestick desk and allows switching chart modes", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(
      screen.getByText(
        /A professional candlestick chart first, with expand-to-window viewing and a structural context mode/i,
      ),
    ).toBeInTheDocument();

    const mainChart = screen.getByTestId("main-market-chart");
    const comparisonChart = screen.getByTestId("comparison-chart");

    expect(
      within(mainChart).getByRole("button", { name: /Candlestick Desk/i }),
    ).toBeInTheDocument();
    expect(
      within(comparisonChart).getByRole("button", { name: /Fit all/i }),
    ).toBeInTheDocument();
    expect(
      within(mainChart).getByRole("button", { name: /^MA 20$/i }),
    ).toBeInTheDocument();
    expect(
      within(mainChart).getByRole("button", { name: /Expand to window/i }),
    ).toBeInTheDocument();

    await user.click(
      within(mainChart).getByRole("button", {
        name: /Long Horizon Context/i,
      }),
    );

    expect(
      within(mainChart).getByText(/Structural annual context/i),
    ).toBeInTheDocument();

    await user.click(
      within(mainChart).getByRole("button", { name: /Compare off/i }),
    );

    expect(within(mainChart).getByText(/Compare ranges/i)).toBeInTheDocument();
  });
});
