import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { WORKSPACES } from "./console/workspaces";

describe("Research Console shell", () => {
  beforeEach(() => {
    window.location.hash = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            schema_version: "test",
            dataset: "STATE_SDP",
            title: "State Domestic Product and other aggregates, 2011-2012 series",
            generated_at: "2026-05-31T00:00:00Z",
            source_status: "source_unavailable",
            source_runs: [],
            geographies: [],
            indicators: [],
            observations: [],
            quality_report: {
              validation_status: "source_unavailable",
              duplicate_count: 0,
              null_count: 0,
              outlier_count: 0,
              coverage: {},
            },
            warnings: ["State SDP workbook link is listed by MoSPI but currently returns 404."],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  test("renders the workspace rail with every workspace", () => {
    render(<App />);
    for (const w of WORKSPACES) {
      expect(screen.getByRole("button", { name: new RegExp(w.title, "i") })).toBeInTheDocument();
    }
  });

  test("defaults to the Index Explorer workspace heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: /Index Explorer/i })).toBeInTheDocument();
  });

  test("selecting a workspace updates the heading and the URL hash", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Macro Lab/i }));
    // hashchange fires asynchronously in jsdom, so await the re-render.
    expect(
      await screen.findByRole("heading", { level: 1, name: /Macro Lab/i }),
    ).toBeInTheDocument();
    expect(window.location.hash).toContain("macro");
  });

  test("selecting State Economy Lab opens the MOSPI source-readiness workspace", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /State Economy Lab/i }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /State Economy Lab/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 2, name: /State SDP source discovery/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(window.location.hash).toContain("state-economy");
  });
});
