import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import App from "./App";

describe("App", () => {
  test("renders the redesigned charts and allows switching main chart modes", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(
      screen.getByText(
        /A truthful long-horizon chart with native pan and zoom, plus an optional technical lens/i,
      ),
    ).toBeInTheDocument();

    const mainChart = screen.getByTestId("main-market-chart");
    const comparisonChart = screen.getByTestId("comparison-chart");

    expect(
      within(mainChart).getByRole("button", { name: /Long Horizon/i }),
    ).toBeInTheDocument();
    expect(
      within(comparisonChart).getByRole("button", { name: /Fit all/i }),
    ).toBeInTheDocument();

    await user.click(
      within(mainChart).getByRole("button", {
        name: /Technical Reconstruction/i,
      }),
    );

    expect(
      within(mainChart).getByText(/Illustrative technical reconstruction/i),
    ).toBeInTheDocument();

    await user.click(
      within(mainChart).getByRole("button", { name: /Compare off/i }),
    );

    expect(within(mainChart).getByText(/Compare ranges/i)).toBeInTheDocument();
  });
});
