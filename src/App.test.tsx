import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import App from "./App";
import { WORKSPACES } from "./console/workspaces";

describe("Research Console shell", () => {
  beforeEach(() => {
    window.location.hash = "";
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
});
