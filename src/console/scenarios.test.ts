import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _clearAll,
  deleteScenario,
  exportJson,
  importJson,
  listScenarios,
  saveScenario,
  updateScenario,
} from "./scenarios";

beforeEach(() => {
  _clearAll();
});

afterEach(() => {
  _clearAll();
});

describe("scenarios", () => {
  it("starts with empty list", () => {
    expect(listScenarios()).toEqual([]);
  });

  it("saves a scenario and assigns an id + createdAt", () => {
    const saved = saveScenario({ name: "Test", hash: "#/index" });
    expect(saved.id).toMatch(/.+/);
    expect(saved.createdAt).toBeGreaterThan(0);
    expect(saved.name).toBe("Test");
    expect(saved.hash).toBe("#/index");
  });

  it("trims and falls back to Untitled for blank names", () => {
    const saved = saveScenario({ name: "   ", hash: "#/x" });
    expect(saved.name).toBe("Untitled");
  });

  it("truncates name to 80 chars and note to 500", () => {
    const longName = "a".repeat(120);
    const longNote = "b".repeat(800);
    const saved = saveScenario({ name: longName, hash: "#/x", note: longNote });
    expect(saved.name.length).toBe(80);
    expect(saved.note!.length).toBe(500);
  });

  it("lists newest first", async () => {
    saveScenario({ name: "first", hash: "#/a" });
    await new Promise((r) => setTimeout(r, 5));
    saveScenario({ name: "second", hash: "#/b" });
    const list = listScenarios();
    expect(list[0].name).toBe("second");
    expect(list[1].name).toBe("first");
  });

  it("updates an existing scenario by id", () => {
    const saved = saveScenario({ name: "Test", hash: "#/x" });
    const ok = updateScenario(saved.id, { name: "Renamed", note: "with note" });
    expect(ok).toBe(true);
    const list = listScenarios();
    expect(list[0].name).toBe("Renamed");
    expect(list[0].note).toBe("with note");
    expect(list[0].hash).toBe("#/x"); // unchanged
  });

  it("returns false when updating an unknown id", () => {
    expect(updateScenario("nope", { name: "x" })).toBe(false);
  });

  it("deletes a scenario by id", () => {
    const a = saveScenario({ name: "a", hash: "#/a" });
    const b = saveScenario({ name: "b", hash: "#/b" });
    expect(deleteScenario(a.id)).toBe(true);
    expect(listScenarios()).toHaveLength(1);
    expect(listScenarios()[0].id).toBe(b.id);
  });

  it("returns false when deleting an unknown id", () => {
    expect(deleteScenario("nope")).toBe(false);
  });
});

describe("scenarios export/import", () => {
  it("exports + imports round-trips", () => {
    saveScenario({ name: "first", hash: "#/a" });
    saveScenario({ name: "second", hash: "#/b", note: "with note" });
    const json = exportJson();
    _clearAll();
    expect(listScenarios()).toEqual([]);
    const result = importJson(json);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.error).toBeUndefined();
    const list = listScenarios();
    expect(list).toHaveLength(2);
    // Sorted by createdAt desc — "second" was created later
    expect(list[0].name).toBe("second");
    expect(list[0].note).toBe("with note");
  });

  it("rejects invalid JSON", () => {
    const r = importJson("not json");
    expect(r.error).toBe("Invalid JSON");
    expect(r.imported).toBe(0);
  });

  it("rejects wrong shape", () => {
    expect(importJson('{"foo":"bar"}').error).toBe("Not a scenarios export");
    expect(importJson("[]").error).toBe("Not a scenarios export");
  });

  it("rejects schema mismatch", () => {
    const r = importJson(JSON.stringify({ schema: 99, scenarios: [] }));
    expect(r.error).toMatch(/Schema mismatch/);
  });

  it("is idempotent — re-importing skips existing ids", () => {
    saveScenario({ name: "x", hash: "#/x" });
    const json = exportJson();
    const r = importJson(json);
    expect(r.imported).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it("skips malformed entries within a valid file", () => {
    const json = JSON.stringify({
      schema: 1,
      scenarios: [
        { id: "ok", name: "ok", hash: "#/x", createdAt: 1 },
        { id: 123 }, // malformed
        { name: "no id", hash: "#/y", createdAt: 2 }, // malformed
      ],
    });
    const r = importJson(json);
    expect(r.imported).toBe(1);
    expect(r.skipped).toBe(2);
  });
});
